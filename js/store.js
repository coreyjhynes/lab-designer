/**
 * store.js — Data models and localStorage persistence for Lab Designer
 */

const Store = (() => {
    const STORAGE_KEY = 'labdesigner_data';

    const defaultData = () => ({
        courses: [],
        labs: [],
        skills: [],
    });

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.error('Failed to load data from localStorage:', e);
        }
        return defaultData();
    }

    function save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save data:', e);
        }
    }

    let data = load();

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    // ---- Skills ----
    function getSkills() { return data.skills; }

    function addSkill(name) {
        name = name.trim();
        if (!name || data.skills.find(s => s.name.toLowerCase() === name.toLowerCase())) return null;
        const skill = { id: uid(), name };
        data.skills.push(skill);
        save(data);
        return skill;
    }

    function removeSkill(id) {
        data.skills = data.skills.filter(s => s.id !== id);
        // Also remove from labs and courses
        data.labs.forEach(lab => {
            lab.skillIds = lab.skillIds.filter(sid => sid !== id);
        });
        data.courses.forEach(c => {
            c.skillIds = c.skillIds.filter(sid => sid !== id);
        });
        save(data);
    }

    function getSkillUsageCount(skillId) {
        let count = 0;
        data.labs.forEach(lab => { if (lab.skillIds.includes(skillId)) count++; });
        data.courses.forEach(c => { if (c.skillIds.includes(skillId)) count++; });
        return count;
    }

    // ---- Labs ----
    function getLabs() { return data.labs; }

    function getLab(id) { return data.labs.find(l => l.id === id) || null; }

    function saveLab(lab) {
        if (!lab.id) {
            lab.id = uid();
            lab.createdAt = new Date().toISOString();
            data.labs.push(lab);
        } else {
            const idx = data.labs.findIndex(l => l.id === lab.id);
            if (idx >= 0) data.labs[idx] = lab;
            else data.labs.push(lab);
        }
        lab.updatedAt = new Date().toISOString();
        save(data);
        return lab;
    }

    function deleteLab(id) {
        data.labs = data.labs.filter(l => l.id !== id);
        // Remove lab from any course modules
        data.courses.forEach(course => {
            course.modules.forEach(mod => {
                mod.labIds = mod.labIds.filter(lid => lid !== id);
            });
        });
        save(data);
    }

    // ---- Courses ----
    function getCourses() { return data.courses; }

    function getCourse(id) { return data.courses.find(c => c.id === id) || null; }

    function saveCourse(course) {
        if (!course.id) {
            course.id = uid();
            course.createdAt = new Date().toISOString();
            data.courses.push(course);
        } else {
            const idx = data.courses.findIndex(c => c.id === course.id);
            if (idx >= 0) data.courses[idx] = course;
            else data.courses.push(course);
        }
        course.updatedAt = new Date().toISOString();
        save(data);
        return course;
    }

    function deleteCourse(id) {
        data.courses = data.courses.filter(c => c.id !== id);
        save(data);
    }

    // ---- Stats ----
    function getStats() {
        const totalMinutes = data.labs.reduce((sum, l) => sum + (parseInt(l.duration) || 0), 0);
        return {
            courses: data.courses.length,
            labs: data.labs.length,
            skills: data.skills.length,
            duration: totalMinutes,
        };
    }

    // ---- Import / Export ----
    function exportAll() {
        return JSON.stringify(data, null, 2);
    }

    function importAll(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            if (imported.courses && imported.labs && imported.skills) {
                data = imported;
                save(data);
                return true;
            }
        } catch (e) {
            console.error('Import failed:', e);
        }
        return false;
    }

    function addSkillIfNotExists(name) {
        name = name.trim();
        const existing = data.skills.find(s => s.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing;
        return addSkill(name);
    }

    return {
        getSkills, addSkill, addSkillIfNotExists, removeSkill, getSkillUsageCount,
        getLabs, getLab, saveLab, deleteLab,
        getCourses, getCourse, saveCourse, deleteCourse,
        getStats, exportAll, importAll,
    };
})();
