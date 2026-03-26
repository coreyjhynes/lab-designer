/**
 * frameworks.js — Skill framework catalog for Lab Designer.
 * Contains metadata for public frameworks that can be used for curriculum mapping.
 */

const Frameworks = (() => {
    const catalog = [
        // Cybersecurity
        { id: 'nice', name: 'NICE Workforce Framework', abbrev: 'NICE', publisher: 'NIST', domain: 'Cybersecurity', description: 'Work roles, tasks, knowledge and skills for cybersecurity workforce (SP 800-181r1).' },
        { id: 'dcwf', name: 'DoD Cyber Workforce Framework', abbrev: 'DCWF', publisher: 'U.S. Department of Defense', domain: 'Cybersecurity', description: 'Extension of NICE with DoD-specific cyber work roles and qualifications.' },
        { id: 'mitre-attack', name: 'MITRE ATT&CK', abbrev: 'ATT&CK', publisher: 'MITRE Corporation', domain: 'Cybersecurity', description: 'Knowledge base of adversary tactics and techniques across Enterprise, Mobile, and ICS.' },
        { id: 'comptia-security', name: 'CompTIA Security+ / CySA+ / CASP+', abbrev: 'CompTIA Sec', publisher: 'CompTIA', domain: 'Cybersecurity', description: 'Vendor-neutral cybersecurity certification exam objectives and competency domains.' },

        // Cloud Computing
        { id: 'comptia-cloud', name: 'CompTIA Cloud+', abbrev: 'Cloud+', publisher: 'CompTIA', domain: 'Cloud Computing', description: 'Vendor-neutral cloud computing competency domains covering architecture, security, deployment, and operations.' },
        { id: 'aws-certs', name: 'AWS Certification Framework', abbrev: 'AWS Certs', publisher: 'Amazon Web Services', domain: 'Cloud Computing', description: 'Role-based certification paths: Practitioner, Associate, Professional, Specialty with detailed skill domains.' },
        { id: 'azure-certs', name: 'Microsoft Azure Certification Framework', abbrev: 'Azure Certs', publisher: 'Microsoft', domain: 'Cloud Computing', description: 'Role-based certifications (Fundamentals, Associate, Expert, Specialty) with structured exam objectives.' },
        { id: 'gcp-certs', name: 'Google Cloud Certification Framework', abbrev: 'GCP Certs', publisher: 'Google Cloud', domain: 'Cloud Computing', description: 'Professional and Associate certifications with detailed domain breakdowns.' },

        // Data, AI & ML
        { id: 'edison', name: 'EDISON Data Science Framework', abbrev: 'EDSF', publisher: 'EDISON Project (EU)', domain: 'Data & AI', description: 'Competence Framework for Data Science covering analytics, engineering, management, and scientific methods.' },
        { id: 'unesco-ai', name: 'UNESCO AI Competency Framework', abbrev: 'UNESCO AI-CF', publisher: 'UNESCO', domain: 'Data & AI', description: '12 competencies across human-centered mindset, ethics, techniques, and system design.' },
        { id: 'oecd-ai', name: 'OECD AI Literacy Framework', abbrev: 'OECD AI Lit', publisher: 'OECD / European Commission', domain: 'Data & AI', description: 'Four core domains: Engage, Create, Manage, and Design with AI.' },

        // Software Engineering
        { id: 'swebok', name: 'SWEBOK v4', abbrev: 'SWEBOK', publisher: 'IEEE Computer Society', domain: 'Software Engineering', description: '18 Knowledge Areas covering the full scope of software engineering, including architecture, security, and operations.' },
        { id: 'swecom', name: 'SWECOM - SE Competency Model', abbrev: 'SWECOM', publisher: 'IEEE Computer Society', domain: 'Software Engineering', description: 'Competency levels mapped to SWEBOK knowledge areas for software engineering workforce development.' },

        // DevOps & SRE
        { id: 'dasa', name: 'DASA DevOps Competence Model', abbrev: 'DASA', publisher: 'DevOps Agile Skills Association', domain: 'DevOps & SRE', description: '4 skill areas and 8 knowledge areas covering technical and behavioral DevOps competencies.' },
        { id: 'sre', name: 'Google SRE Competency Matrix', abbrev: 'SRE', publisher: 'Google / Community', domain: 'DevOps & SRE', description: 'Structured competencies for Site Reliability Engineering: availability, monitoring, capacity planning, incident response.' },

        // IT Operations
        { id: 'comptia-infra', name: 'CompTIA A+ / Server+ / Linux+', abbrev: 'CompTIA Ops', publisher: 'CompTIA', domain: 'IT Operations', description: 'Vendor-neutral exam objectives for IT operations, hardware, OS administration, and server infrastructure.' },
        { id: 'itil', name: 'ITIL 4', abbrev: 'ITIL', publisher: 'PeopleCert / Axelos', domain: 'IT Operations', description: 'Service management practices covering incident management, change enablement, monitoring, and capacity management.' },

        // Networking
        { id: 'comptia-network', name: 'CompTIA Network+', abbrev: 'Network+', publisher: 'CompTIA', domain: 'Networking', description: 'Vendor-neutral networking competency domains: fundamentals, implementation, operations, security, troubleshooting.' },
        { id: 'cisco-ccna', name: 'Cisco CCNA', abbrev: 'CCNA', publisher: 'Cisco Systems', domain: 'Networking', description: 'Network fundamentals, access, IP connectivity/services, security fundamentals, and automation.' },

        // Project Management
        { id: 'gapps', name: 'GAPPS Project Management Standards', abbrev: 'GAPPS', publisher: 'GAPPS (nonprofit)', domain: 'Project Management', description: 'Open-source, performance-based competency standards for project and program managers.' },
        { id: 'ipma-icb', name: 'IPMA ICB4', abbrev: 'ICB4', publisher: 'IPMA', domain: 'Project Management', description: '42 competencies across Technical, Behavioral, and Contextual areas with Agile reference guide.' },

        // Cross-Domain
        { id: 'sfia', name: 'SFIA 9 - Skills Framework for the Information Age', abbrev: 'SFIA', publisher: 'SFIA Foundation', domain: 'Cross-Domain', description: 'Global framework covering 121 professional skills across all digital/IT disciplines, 7 responsibility levels.' },
        { id: 'ecf', name: 'European e-Competence Framework', abbrev: 'e-CF 4.0', publisher: 'CEN', domain: 'Cross-Domain', description: '41 ICT competences across Plan, Build, Run, Enable, Manage areas mapped to European Qualifications Framework.' },
        { id: 'onet', name: 'O*NET Occupational Framework', abbrev: 'O*NET', publisher: 'U.S. Department of Labor', domain: 'Cross-Domain', description: '923 occupations with structured skills, knowledge, abilities, and task data. Updated quarterly.' },
    ];

    // Group by domain
    function getDomains() {
        const domains = {};
        catalog.forEach(fw => {
            if (!domains[fw.domain]) domains[fw.domain] = [];
            domains[fw.domain].push(fw);
        });
        return domains;
    }

    function getById(id) {
        return catalog.find(fw => fw.id === id) || null;
    }

    function getAll() {
        return [...catalog];
    }

    function search(query) {
        const q = query.toLowerCase();
        return catalog.filter(fw =>
            fw.name.toLowerCase().includes(q) ||
            fw.abbrev.toLowerCase().includes(q) ||
            fw.domain.toLowerCase().includes(q) ||
            fw.description.toLowerCase().includes(q)
        );
    }

    return { getDomains, getById, getAll, search };
})();
