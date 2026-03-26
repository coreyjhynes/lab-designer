/**
 * store.js — Data persistence for Lab Designer v2.
 * Manages projects, curriculum, lab blueprints, and conversation history.
 */

const Store = (() => {
    const STORAGE_KEY = 'labdesigner_v2';

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function now() {
        return new Date().toISOString();
    }

    // ── Default project structure ──
    function emptyProject(name) {
        return {
            id: uid(),
            name: name || 'Untitled Project',
            createdAt: now(),
            updatedAt: now(),
            // Phase 1: Define
            uploads: [],        // { id, name, type, size, content }
            goals: [],          // extracted goals/objectives strings
            defineChat: [],     // { role: 'user'|'assistant', content, timestamp }
            // Phase 2: Organize
            curriculum: null,   // nested tree: { type, title, children[] }
            framework: null,    // selected framework id or 'custom'
            frameworkData: null, // custom framework content if uploaded
            organizeChat: [],
            // Phase 3: Labs
            labBlueprints: [],  // { id, title, description, duration, placement, activities[] }
            labsChat: [],
        };
    }

    // ── Storage helpers ──
    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : { projects: [], activeProjectId: null };
        } catch {
            return { projects: [], activeProjectId: null };
        }
    }

    function saveAll(data) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }

    // ── Projects ──
    function getProjects() {
        return loadAll().projects;
    }

    function getActiveProject() {
        const data = loadAll();
        if (!data.activeProjectId || data.projects.length === 0) return null;
        return data.projects.find(p => p.id === data.activeProjectId) || null;
    }

    function setActiveProject(id) {
        const data = loadAll();
        data.activeProjectId = id;
        saveAll(data);
    }

    function createProject(name) {
        const data = loadAll();
        const project = emptyProject(name);
        data.projects.push(project);
        data.activeProjectId = project.id;
        saveAll(data);
        return project;
    }

    function updateProject(project) {
        const data = loadAll();
        const idx = data.projects.findIndex(p => p.id === project.id);
        if (idx >= 0) {
            project.updatedAt = now();
            data.projects[idx] = project;
            saveAll(data);
        }
        return project;
    }

    function deleteProject(id) {
        const data = loadAll();
        data.projects = data.projects.filter(p => p.id !== id);
        if (data.activeProjectId === id) {
            data.activeProjectId = data.projects.length ? data.projects[0].id : null;
        }
        saveAll(data);
    }

    // ── Chat helpers ──
    function addChatMessage(projectId, phase, role, content) {
        const data = loadAll();
        const project = data.projects.find(p => p.id === projectId);
        if (!project) return;
        const chatKey = phase + 'Chat'; // defineChat, organizeChat, labsChat
        if (!project[chatKey]) project[chatKey] = [];
        project[chatKey].push({ role, content, timestamp: now() });
        project.updatedAt = now();
        saveAll(data);
    }

    function getChatHistory(projectId, phase) {
        const project = getProjects().find(p => p.id === projectId);
        if (!project) return [];
        return project[phase + 'Chat'] || [];
    }

    // ── Export / Import ──
    function exportProject(projectId) {
        const project = getProjects().find(p => p.id === projectId);
        return project ? JSON.stringify(project, null, 2) : null;
    }

    function importProject(json) {
        const data = loadAll();
        const project = JSON.parse(json);
        project.id = uid(); // new ID to avoid collision
        project.importedAt = now();
        data.projects.push(project);
        data.activeProjectId = project.id;
        saveAll(data);
        return project;
    }

    return {
        uid,
        getProjects,
        getActiveProject,
        setActiveProject,
        createProject,
        updateProject,
        deleteProject,
        addChatMessage,
        getChatHistory,
        exportProject,
        importProject,
    };
})();
