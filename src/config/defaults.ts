export const PERSONALITY_PROMPTS: Record<string, string> = {
  professional: "Tu es un assistant professionnel. Réponses directes, factuelles et concises. Pas de bavardage.",
  assistant: "Tu es NovaClaw, un assistant IA personnel puissant. Tu es helpful, précis et amical. Tu peux utiliser tes skills pour accomplir des tâches concrètes.",
  casual: "Tu es un assistant cool et décontracté. Tu peux utiliser des émojis et un ton informel. Tu restes efficace tout en étant sympa.",
  minimal: "Réponses ultra-courtes. Pas de blabla. Action directe.",
  custom: "",
};

export const SKILL_PRESETS: Record<string, string[]> = {
  minimal: ["shell", "files"],
  standard: ["browser", "shell", "files", "code-runner", "http", "git"],
  developer: [
    "browser", "shell", "files", "code-runner", "http", "git",
    "github", "docker", "database", "api-tester", "json-processor"
  ],
  power: [
    "browser", "screenshot", "web-scraper", "pdf-reader", "link-preview", "web-monitor",
    "shell", "process-manager", "system-info", "package-manager", "service-manager", "cron-scheduler",
    "files", "file-search", "archive", "file-convert", "file-watch",
    "code-runner", "code-analyzer", "git", "github", "docker", "database", "api-tester",
    "http", "webhook-sender", "dns-lookup",
    "json-processor", "csv-processor", "text-analyzer", "calculator"
  ],
  full: [
    "browser", "screenshot", "web-scraper", "pdf-reader", "link-preview", "web-monitor",
    "shell", "process-manager", "system-info", "package-manager", "service-manager", "cron-scheduler",
    "files", "file-search", "archive", "file-convert", "file-watch", "cloud-storage",
    "code-runner", "code-analyzer", "git", "github", "docker", "database", "api-tester",
    "http", "webhook-sender", "webhook-receiver", "dns-lookup", "port-scanner",
    "json-processor", "csv-processor", "text-analyzer", "image-analyzer", "calculator",
    "email-sender", "email-reader", "sms-sender", "notification",
    "home-assistant", "macro-recorder", "workflow"
  ],
};

export const SECURITY_PRESETS: Record<string, {
  rateLimit: { messagesPerMinute: number; cooldownSeconds: number };
  shell: { mode: "allowlist" | "blocklist"; allowedCommands: string[] };
  code: { allowedLanguages: string[] };
  http: { allowPrivateIPs: boolean };
}> = {
  strict: {
    rateLimit: { messagesPerMinute: 10, cooldownSeconds: 120 },
    shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "pwd"] },
    code: { allowedLanguages: ["javascript"] },
    http: { allowPrivateIPs: false },
  },
  balanced: {
    rateLimit: { messagesPerMinute: 30, cooldownSeconds: 60 },
    shell: { mode: "allowlist", allowedCommands: ["ls", "cat", "head", "tail", "grep", "find", "git", "npm", "node", "python"] },
    code: { allowedLanguages: ["javascript", "python"] },
    http: { allowPrivateIPs: false },
  },
  permissive: {
    rateLimit: { messagesPerMinute: 60, cooldownSeconds: 30 },
    shell: { mode: "blocklist", allowedCommands: [] },
    code: { allowedLanguages: ["javascript", "python", "bash", "typescript"] },
    http: { allowPrivateIPs: true },
  },
};

export const ALL_SKILLS = [
  // Web & Browser
  { id: "browser", name: "Browser", category: "web", description: "Naviguer sur le web, rechercher, lire des pages" },
  { id: "screenshot", name: "Screenshot", category: "web", description: "Capturer des pages web en image" },
  { id: "web-scraper", name: "Web Scraper", category: "web", description: "Extraire des données structurées de sites" },
  { id: "pdf-reader", name: "PDF Reader", category: "web", description: "Lire et extraire du texte de PDFs" },
  { id: "link-preview", name: "Link Preview", category: "web", description: "Prévisualiser les liens" },
  { id: "web-monitor", name: "Web Monitor", category: "web", description: "Surveiller des pages pour changements" },
  // Shell & System
  { id: "shell", name: "Shell", category: "system", description: "Exécuter des commandes système" },
  { id: "process-manager", name: "Process Manager", category: "system", description: "Gérer les processus système" },
  { id: "system-info", name: "System Info", category: "system", description: "Informations système (CPU, RAM, disque)" },
  { id: "package-manager", name: "Package Manager", category: "system", description: "Gérer les packages (npm, pip, etc.)" },
  { id: "service-manager", name: "Service Manager", category: "system", description: "Gérer les services système" },
  { id: "cron-scheduler", name: "Cron Scheduler", category: "system", description: "Planifier des tâches récurrentes" },
  // Files & Storage
  { id: "files", name: "Files", category: "files", description: "Opérations sur fichiers (CRUD)" },
  { id: "file-search", name: "File Search", category: "files", description: "Rechercher des fichiers" },
  { id: "archive", name: "Archive", category: "files", description: "Créer/extraire des archives" },
  { id: "file-convert", name: "File Convert", category: "files", description: "Convertir des formats de fichiers" },
  { id: "file-watch", name: "File Watch", category: "files", description: "Surveiller des fichiers/dossiers" },
  { id: "cloud-storage", name: "Cloud Storage", category: "files", description: "Gérer le stockage cloud" },
  // Code & Dev
  { id: "code-runner", name: "Code Runner", category: "code", description: "Exécuter du code (JS, Python, etc.)" },
  { id: "code-analyzer", name: "Code Analyzer", category: "code", description: "Analyser la qualité du code" },
  { id: "git", name: "Git", category: "code", description: "Opérations Git" },
  { id: "github", name: "GitHub", category: "code", description: "Interagir avec l'API GitHub" },
  { id: "docker", name: "Docker", category: "code", description: "Gérer des containers Docker" },
  { id: "database", name: "Database", category: "code", description: "Requêtes SQL" },
  { id: "api-tester", name: "API Tester", category: "code", description: "Tester des APIs REST/GraphQL" },
  // Network & HTTP
  { id: "http", name: "HTTP", category: "network", description: "Requêtes HTTP" },
  { id: "webhook-sender", name: "Webhook Sender", category: "network", description: "Envoyer des webhooks" },
  { id: "webhook-receiver", name: "Webhook Receiver", category: "network", description: "Recevoir des webhooks" },
  { id: "dns-lookup", name: "DNS Lookup", category: "network", description: "Résolution DNS et WHOIS" },
  { id: "port-scanner", name: "Port Scanner", category: "network", description: "Scanner des ports" },
  // Data & AI
  { id: "json-processor", name: "JSON Processor", category: "data", description: "Traiter des données JSON" },
  { id: "csv-processor", name: "CSV Processor", category: "data", description: "Traiter des fichiers CSV" },
  { id: "text-analyzer", name: "Text Analyzer", category: "data", description: "Analyser du texte" },
  { id: "image-analyzer", name: "Image Analyzer", category: "data", description: "Analyser des images" },
  { id: "calculator", name: "Calculator", category: "data", description: "Calculs mathématiques" },
  // Communication
  { id: "email-sender", name: "Email Sender", category: "communication", description: "Envoyer des emails" },
  { id: "email-reader", name: "Email Reader", category: "communication", description: "Lire des emails" },
  { id: "sms-sender", name: "SMS Sender", category: "communication", description: "Envoyer des SMS" },
  { id: "notification", name: "Notification", category: "communication", description: "Notifications système" },
  // Automation & IoT
  { id: "home-assistant", name: "Home Assistant", category: "automation", description: "Domotique via Home Assistant" },
  { id: "macro-recorder", name: "Macro Recorder", category: "automation", description: "Enregistrer et rejouer des macros" },
  { id: "workflow", name: "Workflow", category: "automation", description: "Chaîner des skills" },
];

export const SKILL_CATEGORIES = [
  { id: "web", name: "Web & Browser", icon: "🌐" },
  { id: "system", name: "Shell & System", icon: "💻" },
  { id: "files", name: "Files & Storage", icon: "📁" },
  { id: "code", name: "Code & Dev", icon: "🧑‍💻" },
  { id: "network", name: "Network & HTTP", icon: "🌍" },
  { id: "data", name: "Data & AI", icon: "📊" },
  { id: "communication", name: "Communication", icon: "📱" },
  { id: "automation", name: "Automation & IoT", icon: "🏠" },
];
