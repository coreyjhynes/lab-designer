/**
 * chat.js — Chat engine for Lab Designer v2.
 * Handles AI conversations for each phase with phase-specific system prompts.
 */

const Chat = (() => {

    // ── System prompts per phase ──

    const SYSTEM_PROMPTS = {
        define: `You are an expert instructional designer helping a program designer plan a hands-on lab training program.

The program designer works at a technology company (like NVIDIA, Commvault, Microsoft, Tableau, etc.) and is building customer and partner enablement programs focused on using specific software applications, platforms, and services to design, implement, deploy, and troubleshoot systems.

Your role in this phase is to help them DEFINE what their learners need to be able to do on the job. Help them:
1. Articulate target audience roles and responsibilities
2. Extract job tasks and performance objectives from uploaded documents or conversation
3. Identify business objectives driving the training need
4. Clarify the technology stack and tools involved

Be conversational and ask clarifying questions. When you have enough information, provide a structured summary of goals.

When you have gathered sufficient information, include a JSON block in your response wrapped in ===GOALS_SUMMARY=== markers like this:
===GOALS_SUMMARY===
{
  "programName": "...",
  "targetAudience": "...",
  "technology": "...",
  "goals": ["goal 1", "goal 2", ...],
  "jobTasks": ["task 1", "task 2", ...],
  "businessObjectives": ["obj 1", "obj 2", ...]
}
===GOALS_SUMMARY===

Only include this block when you feel confident you have enough information. Continue the conversation naturally otherwise.`,

        organize: `You are an expert instructional designer helping organize training content into a structured curriculum.

Based on the program goals defined earlier, help the program designer organize content into:
- Courses (high-level groupings)
- Modules (major sections within a course)
- Lessons (specific learning units)
- Topics (discrete concepts within a lesson)

Also help them:
- Map content to a skill framework if they've selected one
- Identify WHERE each hands-on lab should be embedded in the curriculum
- Recommend lab names and general activity outlines
- Each lab should take learners 45-90 minutes to complete
- Each lab should have 3-5 Activities (Skillable Activities), where each Activity is a set of tasks
- Activities can be scored to track learner progress and expertise

When you generate or update the curriculum structure, include it in a JSON block:
===CURRICULUM===
{
  "courses": [
    {
      "title": "Course Name",
      "modules": [
        {
          "title": "Module Name",
          "lessons": [
            {
              "title": "Lesson Name",
              "topics": ["Topic 1", "Topic 2"],
              "lab": {
                "title": "Lab: Hands-on Lab Name",
                "description": "Brief description of what learner does",
                "duration": 60,
                "activities": [
                  {
                    "title": "Activity 1: Setup and Configuration",
                    "scored": true,
                    "tasks": ["Task description 1", "Task description 2"]
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
===CURRICULUM===

Not every lesson needs a lab. Labs should be placed where hands-on practice is most valuable. Be helpful when the designer wants to consolidate, rename, or reorganize items.`,

        labs: `You are an expert instructional designer and lab environment architect helping finalize Lab Blueprints.

Based on the curriculum and lab placements from Phase 2, help the program designer:

1. Refine each Lab Blueprint with detailed activities and tasks
2. Ensure labs are 45-90 minutes with 3-5 scored Activities each
3. Create Environment Templates (Bill of Materials) — reusable environment configurations that labs share:
   - Virtual machines with specific OS and software
   - Cloud subscriptions and services (Azure, AWS, GCP)
   - Licenses and permissions required
   - Pre-configured dummy/sample data
   - Network configurations and security settings
   - Any pre-installed tools or SDKs

KEY CONCEPT: Each lab program should use ONE or a FEW highly reusable environment templates. Individual labs use the same template — the environment is the hardest part, so reusability is critical.

When you generate or update lab blueprints, include them in a JSON block:
===LAB_BLUEPRINTS===
{
  "environmentTemplates": [
    {
      "id": "env-1",
      "name": "Template Name",
      "description": "What this environment provides",
      "virtualMachines": [
        { "name": "VM Name", "os": "Windows Server 2022", "software": ["SQL Server", "IIS"], "ram": "8GB", "cpu": 4 }
      ],
      "cloudServices": [
        { "provider": "azure", "services": ["App Service", "SQL Database", "Storage Account"] }
      ],
      "licenses": ["License 1"],
      "networking": "Description of network setup",
      "sampleData": "Description of pre-loaded data",
      "credentials": "How credentials are provisioned"
    }
  ],
  "labBlueprints": [
    {
      "id": "lab-1",
      "title": "Lab Name",
      "description": "What the learner accomplishes",
      "duration": 60,
      "environmentTemplate": "env-1",
      "placement": "Course > Module > Lesson",
      "activities": [
        {
          "title": "Activity Name",
          "description": "What this activity covers",
          "scored": true,
          "estimatedMinutes": 15,
          "tasks": [
            { "description": "Task description", "scorable": true, "scoreMethod": "resource-validation" }
          ]
        }
      ]
    }
  ]
}
===LAB_BLUEPRINTS===

Help the designer think through environment reusability. Suggest consolidation where possible.`
    };

    // ── Build messages array for AI call ──
    function buildMessages(phase, project, userMessage) {
        const messages = [{ role: 'system', content: SYSTEM_PROMPTS[phase] }];

        // Add context from earlier phases
        if (phase === 'organize' || phase === 'labs') {
            if (project.goals && project.goals.length > 0) {
                messages.push({
                    role: 'system',
                    content: `Program context from Phase 1:\n- Goals: ${project.goals.join('; ')}\n- Uploads: ${project.uploads.map(u => u.name).join(', ') || 'none'}`
                });
            }
        }

        if (phase === 'labs' && project.curriculum) {
            messages.push({
                role: 'system',
                content: `Curriculum structure from Phase 2:\n${JSON.stringify(project.curriculum, null, 2)}`
            });
        }

        // Add upload content for Define phase
        if (phase === 'define' && project.uploads && project.uploads.length > 0) {
            const uploadContext = project.uploads
                .filter(u => u.content)
                .map(u => `--- ${u.name} ---\n${u.content}`)
                .join('\n\n');
            if (uploadContext) {
                messages.push({
                    role: 'system',
                    content: `The program designer has uploaded these documents:\n\n${uploadContext}`
                });
            }
        }

        // Add chat history
        const history = project[phase + 'Chat'] || [];
        history.forEach(msg => {
            messages.push({ role: msg.role, content: msg.content });
        });

        // Add current message
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }

    // ── Send message and get response ──
    async function send(phase, project, userMessage) {
        const messages = buildMessages(phase, project, userMessage);
        const response = await Settings.callAI(messages, { maxTokens: 4096 });
        return response;
    }

    // ── Parse structured data from AI responses ──
    function parseGoalsSummary(text) {
        const match = text.match(/===GOALS_SUMMARY===([\s\S]*?)===GOALS_SUMMARY===/);
        if (!match) return null;
        try { return JSON.parse(match[1].trim()); } catch { return null; }
    }

    function parseCurriculum(text) {
        const match = text.match(/===CURRICULUM===([\s\S]*?)===CURRICULUM===/);
        if (!match) return null;
        try { return JSON.parse(match[1].trim()); } catch { return null; }
    }

    function parseLabBlueprints(text) {
        const match = text.match(/===LAB_BLUEPRINTS===([\s\S]*?)===LAB_BLUEPRINTS===/);
        if (!match) return null;
        try { return JSON.parse(match[1].trim()); } catch { return null; }
    }

    // ── Strip markers from display text ──
    function cleanResponseForDisplay(text) {
        return text
            .replace(/===GOALS_SUMMARY===[\s\S]*?===GOALS_SUMMARY===/g, '')
            .replace(/===CURRICULUM===[\s\S]*?===CURRICULUM===/g, '')
            .replace(/===LAB_BLUEPRINTS===[\s\S]*?===LAB_BLUEPRINTS===/g, '')
            .trim();
    }

    return {
        send,
        parseGoalsSummary,
        parseCurriculum,
        parseLabBlueprints,
        cleanResponseForDisplay,
        SYSTEM_PROMPTS,
    };
})();
