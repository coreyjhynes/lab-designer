/**
 * app.js — Main UI logic for Lab Designer v2.
 * Handles navigation, chat interactions, outline rendering, and settings.
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── State ──
    let currentPhase = 'define';
    let currentProject = null;
    let pendingFiles = []; // files waiting to be sent with next message

    // ── DOM refs ──
    const $ = (sel, ctx) => (ctx || document).querySelector(sel);
    const $$ = (sel, ctx) => [...(ctx || document).querySelectorAll(sel)];

    // ── Initialize ──
    init();

    function init() {
        loadOrCreateProject();
        bindNavigation();
        bindSettings();
        bindChat('define');
        bindChat('organize');
        bindChat('labs');
        bindFileUpload();
        bindProjectControls();
        bindContextTabs();
        renderPhase();
        showWelcomeMessages();
    }

    // ── Project management ──
    function loadOrCreateProject() {
        currentProject = Store.getActiveProject();
        if (!currentProject) {
            currentProject = Store.createProject('My Lab Program');
        }
        renderProjectSelector();
    }

    function renderProjectSelector() {
        const select = $('#project-select');
        const projects = Store.getProjects();
        select.innerHTML = projects.map(p =>
            `<option value="${p.id}" ${p.id === currentProject.id ? 'selected' : ''}>${p.name}</option>`
        ).join('') + '<option value="__new__">+ New Project...</option>';
    }

    function bindProjectControls() {
        $('#project-select').addEventListener('change', (e) => {
            if (e.target.value === '__new__') {
                const name = prompt('Project name:');
                if (name) {
                    currentProject = Store.createProject(name);
                    renderProjectSelector();
                    clearAllChats();
                    renderPhase();
                    showWelcomeMessages();
                } else {
                    e.target.value = currentProject.id;
                }
            } else {
                Store.setActiveProject(e.target.value);
                currentProject = Store.getActiveProject();
                clearAllChats();
                restoreChats();
                renderPhase();
            }
        });

        $('#btn-new-project').addEventListener('click', () => {
            const name = prompt('Project name:');
            if (name) {
                currentProject = Store.createProject(name);
                renderProjectSelector();
                clearAllChats();
                renderPhase();
                showWelcomeMessages();
            }
        });

        // Export
        $('#btn-export').addEventListener('click', () => {
            const json = Store.exportProject(currentProject.id);
            if (json) {
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `${currentProject.name.replace(/\s+/g, '-')}.json`;
                a.click();
            }
        });

        // Import
        $('#btn-import').addEventListener('click', () => $('#import-file').click());
        $('#import-file').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    currentProject = Store.importProject(ev.target.result);
                    renderProjectSelector();
                    clearAllChats();
                    restoreChats();
                    renderPhase();
                } catch (err) {
                    alert('Import failed: ' + err.message);
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // ── Navigation ──
    function bindNavigation() {
        $$('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const phase = link.dataset.phase;
                if (!phase) return;
                switchPhase(phase);
            });
        });
    }

    function switchPhase(phase) {
        currentPhase = phase;
        $$('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.phase === phase));
        $$('.phase').forEach(p => p.classList.toggle('active', p.id === `phase-${phase}`));
    }

    // ── Context Tabs (Organize phase) ──
    function bindContextTabs() {
        $$('.context-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const panel = tab.closest('.context-panel');
                panel.querySelectorAll('.context-tab').forEach(t => t.classList.remove('active'));
                panel.querySelectorAll('.context-tab-panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active');
                const target = panel.querySelector(`#tab-${tab.dataset.tab}`);
                if (target) target.classList.add('active');
            });
        });
    }

    // ── Chat system ──
    function bindChat(phase) {
        const input = $(`#${phase}-chat-input`);
        const sendBtn = $(`#${phase}-chat-send`);

        if (!input || !sendBtn) return;

        const sendMessage = () => {
            const text = input.value.trim();
            if (!text && pendingFiles.length === 0) return;
            handleSend(phase, text);
            input.value = '';
            input.style.height = 'auto';
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        });
    }

    async function handleSend(phase, text) {
        if (!Settings.isConfigured()) {
            addChatBubble(phase, 'assistant', 'Please configure your AI provider in Settings first.');
            switchPhase('settings');
            return;
        }

        // Handle file attachments for define phase
        let messageText = text;
        if (phase === 'define' && pendingFiles.length > 0) {
            const fileNames = pendingFiles.map(f => f.name).join(', ');
            messageText = text
                ? `${text}\n\n[Attached files: ${fileNames}]`
                : `I've uploaded these documents: ${fileNames}. Please analyze them.`;

            // Save uploads to project
            currentProject.uploads = currentProject.uploads || [];
            pendingFiles.forEach(f => {
                currentProject.uploads.push({
                    id: Store.uid(),
                    name: f.name,
                    type: f.type,
                    size: f.size,
                    content: f.content,
                });
            });
            Store.updateProject(currentProject);
            renderUploads();
            pendingFiles = [];
            renderAttachments();
        }

        // Show user message
        addChatBubble(phase, 'user', messageText);
        Store.addChatMessage(currentProject.id, phase, 'user', messageText);

        // Show typing
        showTyping(phase, true);

        try {
            // Refresh project from store
            currentProject = Store.getActiveProject();
            const response = await Chat.send(phase, currentProject, messageText);

            showTyping(phase, false);

            // Parse structured data from response
            if (phase === 'define') {
                const goals = Chat.parseGoalsSummary(response);
                if (goals) {
                    currentProject.goals = goals.goals || [];
                    currentProject.programName = goals.programName;
                    currentProject.targetAudience = goals.targetAudience;
                    currentProject.technology = goals.technology;
                    currentProject.jobTasks = goals.jobTasks;
                    currentProject.businessObjectives = goals.businessObjectives;
                    Store.updateProject(currentProject);
                    renderGoals();
                }
            } else if (phase === 'organize') {
                const curriculum = Chat.parseCurriculum(response);
                if (curriculum) {
                    currentProject.curriculum = curriculum;
                    Store.updateProject(currentProject);
                    renderCurriculum();
                }
            } else if (phase === 'labs') {
                const blueprints = Chat.parseLabBlueprints(response);
                if (blueprints) {
                    currentProject.labBlueprints = blueprints.labBlueprints || [];
                    currentProject.environmentTemplates = blueprints.environmentTemplates || [];
                    Store.updateProject(currentProject);
                    renderLabBlueprints();
                }
            }

            // Show cleaned response
            const displayText = Chat.cleanResponseForDisplay(response);
            if (displayText) {
                addChatBubble(phase, 'assistant', displayText);
                Store.addChatMessage(currentProject.id, phase, 'assistant', displayText);
            }
        } catch (err) {
            showTyping(phase, false);
            addChatBubble(phase, 'assistant', `Error: ${err.message}`);
        }
    }

    function addChatBubble(phase, role, content) {
        const container = $(`#${phase}-chat-messages`);
        if (!container) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-bubble ${role}`;
        bubble.innerHTML = formatMessage(content);
        container.appendChild(bubble);
        container.scrollTop = container.scrollHeight;
    }

    function showTyping(phase, show) {
        const el = $(`#${phase}-chat-typing`);
        if (el) el.style.display = show ? 'block' : 'none';
        if (show) {
            const container = $(`#${phase}-chat-messages`);
            if (container) container.scrollTop = container.scrollHeight;
        }
    }

    function formatMessage(text) {
        // Simple markdown-ish formatting
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.+?)`/g, '<code>$1</code>')
            .replace(/\n- /g, '\n&bull; ')
            .replace(/\n\d+\.\s/g, (m) => '\n' + m.trim() + ' ')
            .replace(/\n/g, '<br>');
    }

    function showWelcomeMessages() {
        const defineChat = currentProject.defineChat || [];
        if (defineChat.length === 0) {
            addChatBubble('define', 'assistant',
                `Welcome to Lab Designer! I'm here to help you create a hands-on lab training program.\n\n` +
                `Let's start by understanding what your learners need to be able to do. You can:\n\n` +
                `- **Upload documents** like job task analyses, job descriptions, or learning objectives using the paperclip icon\n` +
                `- **Tell me about your program** — what technology, platform, or product are your learners using? Who is the target audience?\n` +
                `- **Paste objectives** directly into the chat\n\n` +
                `What are you building training for?`
            );
        }
    }

    function clearAllChats() {
        ['define', 'organize', 'labs'].forEach(phase => {
            const container = $(`#${phase}-chat-messages`);
            if (container) container.innerHTML = '';
        });
        renderUploads();
        renderGoals();
        renderCurriculum();
        renderLabBlueprints();
    }

    function restoreChats() {
        ['define', 'organize', 'labs'].forEach(phase => {
            const history = currentProject[phase + 'Chat'] || [];
            history.forEach(msg => addChatBubble(phase, msg.role, msg.content));
        });
        if ((currentProject.defineChat || []).length === 0) {
            showWelcomeMessages();
        }
        renderUploads();
        renderGoals();
        renderCurriculum();
        renderLabBlueprints();
    }

    // ── File upload (Define phase) ──
    function bindFileUpload() {
        const uploadBtn = $('#define-upload-btn');
        const fileInput = $('#define-file-input');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                Array.from(e.target.files).forEach(file => {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        pendingFiles.push({
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            content: ev.target.result,
                        });
                        renderAttachments();
                    };
                    reader.readAsText(file);
                });
                e.target.value = '';
            });
        }

        // Framework upload
        const fwBtn = $('#btn-upload-framework');
        const fwInput = $('#framework-file-input');
        if (fwBtn && fwInput) {
            fwBtn.addEventListener('click', () => fwInput.click());
            fwInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    currentProject.framework = 'custom';
                    currentProject.frameworkData = {
                        name: file.name,
                        content: ev.target.result,
                    };
                    Store.updateProject(currentProject);
                    $('#framework-select').value = '';
                    renderFrameworkMapping();
                };
                reader.readAsText(file);
                e.target.value = '';
            });
        }

        // Framework select change
        const fwSelect = $('#framework-select');
        if (fwSelect) {
            fwSelect.addEventListener('change', () => {
                currentProject.framework = fwSelect.value || null;
                Store.updateProject(currentProject);
                renderFrameworkMapping();
            });
        }
    }

    function renderAttachments() {
        const container = $('#define-attachments');
        if (!container) return;
        container.innerHTML = pendingFiles.map((f, i) =>
            `<span class="chat-attachment-chip">${f.name} <span class="remove" data-idx="${i}">&times;</span></span>`
        ).join('');
        container.querySelectorAll('.remove').forEach(btn => {
            btn.addEventListener('click', () => {
                pendingFiles.splice(parseInt(btn.dataset.idx), 1);
                renderAttachments();
            });
        });
    }

    // ── Render context panels ──

    function renderUploads() {
        const list = $('#define-uploads-list');
        if (!list) return;
        const uploads = currentProject.uploads || [];
        if (uploads.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No documents uploaded yet.</p><p class="hint">Upload job task analyses, job descriptions, learning objectives, or other source documents.</p></div>';
            return;
        }
        list.innerHTML = uploads.map(u => `
            <div class="upload-item">
                <div class="upload-item-icon">&#128196;</div>
                <div class="upload-item-info">
                    <div class="upload-item-name">${escHtml(u.name)}</div>
                    <div class="upload-item-meta">${formatFileSize(u.size)}</div>
                </div>
                <button class="upload-item-remove" data-id="${u.id}" title="Remove">&times;</button>
            </div>
        `).join('');
        list.querySelectorAll('.upload-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                currentProject.uploads = currentProject.uploads.filter(u => u.id !== btn.dataset.id);
                Store.updateProject(currentProject);
                renderUploads();
            });
        });
    }

    function renderGoals() {
        const summary = $('#define-summary');
        const goalsList = $('#define-goals-list');
        if (!summary || !goalsList) return;
        const goals = currentProject.goals || [];
        if (goals.length === 0) {
            summary.style.display = 'none';
            return;
        }
        summary.style.display = 'block';
        goalsList.innerHTML = goals.map(g => `<div class="goal-item">${escHtml(g)}</div>`).join('');
    }

    function renderCurriculum() {
        const container = $('#curriculum-outline');
        if (!container) return;
        const curriculum = currentProject.curriculum;
        if (!curriculum || !curriculum.courses || curriculum.courses.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No curriculum generated yet.</p><p class="hint">Complete Phase 1 or ask me to generate a curriculum structure from your goals.</p></div>';
            return;
        }
        container.innerHTML = curriculum.courses.map(course => renderOutlineNode(course, 'course')).join('');
        bindOutlineInteractions(container);
    }

    function renderOutlineNode(node, type) {
        const hasChildren = (type === 'course' && node.modules) ||
                           (type === 'module' && node.lessons) ||
                           (type === 'lesson' && (node.topics || node.lab));
        const childHtml = [];

        if (type === 'course' && node.modules) {
            node.modules.forEach(m => childHtml.push(renderOutlineNode(m, 'module')));
        }
        if (type === 'module' && node.lessons) {
            node.lessons.forEach(l => childHtml.push(renderOutlineNode(l, 'lesson')));
        }
        if (type === 'lesson') {
            if (node.topics) {
                node.topics.forEach(t => {
                    childHtml.push(`
                        <div class="outline-node">
                            <div class="outline-node-header">
                                <span class="outline-toggle"></span>
                                <span class="outline-node-badge badge-topic">Topic</span>
                                <span class="outline-node-title">${escHtml(typeof t === 'string' ? t : t.title)}</span>
                                <div class="outline-node-actions">
                                    <button class="outline-action-btn" data-action="edit" title="Rename">&#9998;</button>
                                </div>
                            </div>
                        </div>
                    `);
                });
            }
            if (node.lab) {
                childHtml.push(renderLabInOutline(node.lab));
            }
        }

        return `
            <div class="outline-node ${hasChildren ? 'expanded' : ''}">
                <div class="outline-node-header">
                    ${hasChildren ? '<span class="outline-toggle">&#9654;</span>' : '<span class="outline-toggle"></span>'}
                    <span class="outline-node-badge badge-${type}">${type}</span>
                    <span class="outline-node-title">${escHtml(node.title)}</span>
                    <div class="outline-node-actions">
                        <button class="outline-action-btn" data-action="edit" title="Rename">&#9998;</button>
                    </div>
                </div>
                ${hasChildren ? `<div class="outline-node-children">${childHtml.join('')}</div>` : ''}
            </div>
        `;
    }

    function renderLabInOutline(lab) {
        const activities = (lab.activities || []).map((a, i) => `
            <div class="activity-card">
                <div class="activity-header">
                    <span class="activity-number">${i + 1}</span>
                    <span class="activity-title">${escHtml(a.title)}</span>
                    ${a.scored ? '<span class="activity-scored">Scored</span>' : ''}
                </div>
                <div class="activity-body">
                    <div class="task-list">
                        ${(a.tasks || []).map(t => `
                            <div class="task-item">
                                <div class="task-check"></div>
                                <span class="task-text">${escHtml(typeof t === 'string' ? t : t.description)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        return `
            <div class="lab-blueprint">
                <div class="lab-blueprint-header">
                    <span class="lab-blueprint-toggle">&#9654;</span>
                    <span class="lab-blueprint-title">${escHtml(lab.title)}</span>
                    <span class="lab-blueprint-meta">${lab.duration || 60} min &middot; ${(lab.activities || []).length} activities</span>
                </div>
                <div class="lab-blueprint-body">
                    ${lab.description ? `<div class="lab-blueprint-description">${escHtml(lab.description)}</div>` : ''}
                    ${activities}
                </div>
            </div>
        `;
    }

    function bindOutlineInteractions(container) {
        // Toggle expand/collapse
        container.querySelectorAll('.outline-node-header').forEach(header => {
            header.addEventListener('click', (e) => {
                if (e.target.closest('.outline-action-btn') || e.target.closest('.outline-node-title-input')) return;
                const node = header.closest('.outline-node');
                node.classList.toggle('expanded');
            });
        });

        // Toggle lab blueprints
        container.querySelectorAll('.lab-blueprint-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.lab-blueprint').classList.toggle('expanded');
            });
        });

        // Toggle activities
        container.querySelectorAll('.activity-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.activity-card').classList.toggle('expanded');
            });
        });

        // Inline edit
        container.querySelectorAll('.outline-action-btn[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const header = btn.closest('.outline-node-header');
                const titleEl = header.querySelector('.outline-node-title');
                const currentText = titleEl.textContent;

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'outline-node-title-input';
                input.value = currentText;
                titleEl.replaceWith(input);
                input.focus();
                input.select();

                const finish = () => {
                    const newTitle = input.value.trim() || currentText;
                    const span = document.createElement('span');
                    span.className = 'outline-node-title';
                    span.textContent = newTitle;
                    input.replaceWith(span);
                    // Update data (simplified — re-renders on next AI response)
                    updateCurriculumTitle(currentText, newTitle);
                };

                input.addEventListener('blur', finish);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') finish();
                    if (e.key === 'Escape') { input.value = currentText; finish(); }
                });
            });
        });
    }

    function updateCurriculumTitle(oldTitle, newTitle) {
        if (!currentProject.curriculum || oldTitle === newTitle) return;
        // Deep search and replace title in curriculum
        const replaceInNode = (obj) => {
            if (!obj) return;
            if (obj.title === oldTitle) obj.title = newTitle;
            if (obj.courses) obj.courses.forEach(replaceInNode);
            if (obj.modules) obj.modules.forEach(replaceInNode);
            if (obj.lessons) obj.lessons.forEach(replaceInNode);
            if (obj.lab && obj.lab.title === oldTitle) obj.lab.title = newTitle;
        };
        replaceInNode(currentProject.curriculum);
        Store.updateProject(currentProject);
    }

    function renderLabBlueprints() {
        const container = $('#labs-outline');
        const statsEl = $('#lab-stats');
        if (!container) return;

        const blueprints = currentProject.labBlueprints || [];
        const templates = currentProject.environmentTemplates || [];

        if (blueprints.length === 0 && templates.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No labs designed yet.</p><p class="hint">Complete the curriculum outline in Phase 2, then I\'ll recommend where to place labs.</p></div>';
            if (statsEl) statsEl.innerHTML = '';
            return;
        }

        // Stats
        if (statsEl) {
            const totalDuration = blueprints.reduce((sum, b) => sum + (b.duration || 60), 0);
            const totalActivities = blueprints.reduce((sum, b) => sum + (b.activities || []).length, 0);
            statsEl.innerHTML = `
                <span class="lab-stat"><span class="lab-stat-value">${blueprints.length}</span> labs</span>
                <span class="lab-stat"><span class="lab-stat-value">${totalActivities}</span> activities</span>
                <span class="lab-stat"><span class="lab-stat-value">${Math.round(totalDuration / 60)}h ${totalDuration % 60}m</span> total</span>
                <span class="lab-stat"><span class="lab-stat-value">${templates.length}</span> env templates</span>
            `;
        }

        let html = '';

        // Environment templates
        if (templates.length > 0) {
            html += '<h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:#6b7280;">Environment Templates</h4>';
            templates.forEach(t => {
                html += `
                    <div class="lab-blueprint" style="border-color:#d1d5db;">
                        <div class="lab-blueprint-header" style="background:#f3f4f6;">
                            <span class="lab-blueprint-toggle" style="color:#374151;">&#9654;</span>
                            <span class="lab-blueprint-title" style="color:#374151;">&#9881; ${escHtml(t.name)}</span>
                        </div>
                        <div class="lab-blueprint-body">
                            <div class="lab-blueprint-description">${escHtml(t.description || '')}</div>
                            ${t.virtualMachines ? `<p style="font-size:12px;margin:4px 0;"><strong>VMs:</strong> ${t.virtualMachines.map(v => v.name + ' (' + v.os + ')').join(', ')}</p>` : ''}
                            ${t.cloudServices ? `<p style="font-size:12px;margin:4px 0;"><strong>Cloud:</strong> ${t.cloudServices.map(c => c.provider + ': ' + c.services.join(', ')).join('; ')}</p>` : ''}
                            ${t.licenses ? `<p style="font-size:12px;margin:4px 0;"><strong>Licenses:</strong> ${t.licenses.join(', ')}</p>` : ''}
                            ${t.sampleData ? `<p style="font-size:12px;margin:4px 0;"><strong>Sample Data:</strong> ${escHtml(t.sampleData)}</p>` : ''}
                        </div>
                    </div>
                `;
            });
            html += '<h4 style="font-size:13px;font-weight:600;margin:16px 0 8px;color:#6b7280;">Lab Blueprints</h4>';
        }

        // Lab blueprints
        blueprints.forEach(lab => {
            const activities = (lab.activities || []).map((a, i) => `
                <div class="activity-card">
                    <div class="activity-header">
                        <span class="activity-number">${i + 1}</span>
                        <span class="activity-title">${escHtml(a.title)}</span>
                        ${a.scored ? '<span class="activity-scored">Scored</span>' : ''}
                    </div>
                    <div class="activity-body">
                        ${a.description ? `<p style="font-size:12px;color:#6b7280;margin-bottom:8px;">${escHtml(a.description)}</p>` : ''}
                        ${a.estimatedMinutes ? `<p style="font-size:11px;color:#9ca3af;margin-bottom:6px;">~${a.estimatedMinutes} minutes</p>` : ''}
                        <div class="task-list">
                            ${(a.tasks || []).map(t => `
                                <div class="task-item">
                                    <div class="task-check"></div>
                                    <span class="task-text">${escHtml(typeof t === 'string' ? t : t.description)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `).join('');

            const envTemplate = templates.find(t => t.id === lab.environmentTemplate);

            html += `
                <div class="lab-blueprint">
                    <div class="lab-blueprint-header">
                        <span class="lab-blueprint-toggle">&#9654;</span>
                        <span class="lab-blueprint-title">${escHtml(lab.title)}</span>
                        <span class="lab-blueprint-meta">${lab.duration || 60} min &middot; ${(lab.activities || []).length} activities</span>
                    </div>
                    <div class="lab-blueprint-body">
                        ${lab.description ? `<div class="lab-blueprint-description">${escHtml(lab.description)}</div>` : ''}
                        ${lab.placement ? `<p style="font-size:12px;color:#6b7280;margin-bottom:8px;">&#128205; ${escHtml(lab.placement)}</p>` : ''}
                        ${envTemplate ? `<p style="font-size:12px;color:#6b7280;margin-bottom:8px;">&#9881; Environment: ${escHtml(envTemplate.name)}</p>` : ''}
                        ${activities}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Bind interactions
        container.querySelectorAll('.lab-blueprint-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.lab-blueprint').classList.toggle('expanded');
            });
        });
        container.querySelectorAll('.activity-header').forEach(header => {
            header.addEventListener('click', () => {
                header.closest('.activity-card').classList.toggle('expanded');
            });
        });
    }

    function renderFrameworkMapping() {
        const container = $('#framework-mapping');
        if (!container) return;
        const fw = currentProject.framework;
        if (!fw) {
            container.innerHTML = '<div class="empty-state"><p>Select a framework above to see mapping suggestions.</p></div>';
            return;
        }
        if (fw === 'custom' && currentProject.frameworkData) {
            container.innerHTML = `<div class="goal-item">Custom framework loaded: ${escHtml(currentProject.frameworkData.name)}</div>
                <p style="font-size:12px;color:#6b7280;margin-top:8px;">Ask me in the chat to map your curriculum to this framework.</p>`;
            return;
        }
        const info = Frameworks.getById(fw);
        if (info) {
            container.innerHTML = `
                <div class="goal-item"><strong>${escHtml(info.name)}</strong> (${escHtml(info.publisher)})</div>
                <p style="font-size:12px;color:#6b7280;margin-top:8px;">${escHtml(info.description)}</p>
                <p style="font-size:12px;color:#6b7280;margin-top:4px;">Ask me in the chat to map your curriculum to this framework.</p>
            `;
        }
    }

    // ── Render current phase ──
    function renderPhase() {
        renderUploads();
        renderGoals();
        renderCurriculum();
        renderLabBlueprints();
        renderFrameworkMapping();
        if (currentProject.framework) {
            const sel = $('#framework-select');
            if (sel && currentProject.framework !== 'custom') sel.value = currentProject.framework;
        }
    }

    // ── Settings ──
    function bindSettings() {
        const s = Settings.get();

        // Populate
        $('#settings-ai-provider').value = s.aiProvider || 'claude';
        $('#settings-api-key').value = s.apiKey || '';
        $('#settings-model').value = s.model || '';
        $('#settings-endpoint').value = s.endpointUrl || '';
        $('#settings-target-duration').value = s.targetDuration || 60;
        $('#settings-activities-per-lab').value = s.activitiesPerLab || 4;

        toggleEndpointField(s.aiProvider);

        // Provider change
        $('#settings-ai-provider').addEventListener('change', (e) => {
            toggleEndpointField(e.target.value);
        });

        // Toggle key visibility
        $('#settings-toggle-key').addEventListener('click', () => {
            const input = $('#settings-api-key');
            const btn = $('#settings-toggle-key');
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Hide';
            } else {
                input.type = 'password';
                btn.textContent = 'Show';
            }
        });

        // Test connection
        $('#settings-test-connection').addEventListener('click', async () => {
            const resultEl = $('#settings-test-result');
            resultEl.textContent = 'Testing...';
            resultEl.style.color = '#6b7280';

            // Save first
            saveSettings();

            const result = await Settings.testConnection();
            resultEl.textContent = result.ok ? 'Connected!' : `Failed: ${result.message}`;
            resultEl.style.color = result.ok ? '#10b981' : '#ef4444';
        });

        // Save
        $('#settings-save').addEventListener('click', () => {
            saveSettings();
            const resultEl = $('#settings-test-result');
            resultEl.textContent = 'Settings saved!';
            resultEl.style.color = '#10b981';
            setTimeout(() => { resultEl.textContent = ''; }, 2000);
        });
    }

    function saveSettings() {
        Settings.update({
            aiProvider: $('#settings-ai-provider').value,
            apiKey: $('#settings-api-key').value,
            model: $('#settings-model').value,
            endpointUrl: $('#settings-endpoint').value,
            targetDuration: parseInt($('#settings-target-duration').value) || 60,
            activitiesPerLab: parseInt($('#settings-activities-per-lab').value) || 4,
        });
    }

    function toggleEndpointField(provider) {
        const group = $('#settings-endpoint-group');
        if (group) group.style.display = provider === 'custom' ? 'block' : 'none';
    }

    // ── Utilities ──
    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatFileSize(bytes) {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
});
