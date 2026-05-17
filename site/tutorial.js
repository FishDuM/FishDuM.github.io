const DOC_GROUPS = [
    {
        title: "基础",
        items: [
            { href: "tutorial-basic.html", label: "零基础入门" },
            { href: "tutorial-basic-programming.html", label: "编程基础" },
            { href: "tutorial-basic-tools.html", label: "开发工具" }
        ]
    },
    {
        title: "前端",
        items: [
            { href: "tutorial-html.html", label: "HTML" },
            { href: "tutorial-css.html", label: "CSS" },
            { href: "tutorial-javascript.html", label: "JavaScript" },
            { href: "tutorial-frontend-frameworks.html", label: "Vue / React" }
        ]
    },
    {
        title: "后端",
        items: [
            { href: "tutorial-java-basic.html", label: "Java" },
            { href: "tutorial-springboot.html", label: "Spring Boot" },
            { href: "tutorial-database-cache.html", label: "MySQL / Redis" },
            { href: "tutorial-java-backend.html", label: "后端总览" }
        ]
    },
    {
        title: "扩展",
        items: [
            { href: "tutorial-go.html", label: "Go" },
            { href: "tutorial-python.html", label: "Python" },
            { href: "tutorial-client.html", label: "iOS / Android" },
            { href: "tutorial-bigdata.html", label: "大数据" },
            { href: "tutorial-ai.html", label: "AI / Agent / 大模型" }
        ]
    }
];

const CODE_LANGUAGE_LABELS = {
    html: "HTML",
    css: "CSS",
    javascript: "JavaScript",
    java: "Java",
    shell: "Shell",
    json: "JSON",
    sql: "SQL",
    text: "Text"
};

function getCurrentPage() {
    const raw = window.location.pathname.split("/").pop();
    return raw || "plan.html";
}

function slugifyHeading(text, index) {
    const compact = text.trim().replace(/\s+/g, "-");
    if (compact) {
        return `doc-${index + 1}-${compact.replace(/[^\w\u4e00-\u9fa5-]/g, "")}`;
    }
    return `doc-${index + 1}`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function createStore() {
    const bucket = [];
    return {
        push(html) {
            const key = `@@TOKEN_${bucket.length}@@`;
            bucket.push(html);
            return key;
        },
        pull(text) {
            return text.replace(/@@TOKEN_(\d+)@@/g, (_, idx) => bucket[Number(idx)] || "");
        }
    };
}

function wrap(type, text) {
    return `<span class="${type}">${text}</span>`;
}

function safeEntityHighlight(text) {
    return text
        .replace(/&lt;/g, wrap("token-punctuation", "&lt;"))
        .replace(/&gt;/g, wrap("token-punctuation", "&gt;"))
        .replace(/&amp;/g, wrap("token-punctuation", "&amp;"));
}

function highlightHtml(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/&lt;!--[\s\S]*?--&gt;/g, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/"[^"]*"|'[^']*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/(&lt;\/?)([\w:-]+)/g, (_, p1, p2) => `${wrap("token-punctuation", p1)}${wrap("token-tag", p2)}`);
    text = text.replace(/([\w:-]+)(=)/g, (_, a, eq) => `${wrap("token-attr", a)}${wrap("token-punctuation", eq)}`);
    text = text.replace(/\/?&gt;/g, (m) => wrap("token-punctuation", m));
    return store.pull(text);
}

function highlightCss(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/"[^"]*"|'[^']*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/(^|}|\n)(\s*[^{}\n]+)(?=\s*\{)/g, (_, s, sel) => `${s}${wrap("token-selector", sel)}`);
    text = text.replace(/([\w-]+)(\s*:)/g, (_, prop, colon) => `${wrap("token-property", prop)}${wrap("token-punctuation", colon)}`);
    text = text.replace(/\b(display|position|flex|grid|absolute|relative|fixed|sticky|block|inline|none|auto|center|space-between|repeat|minmax)\b/g, (m) => wrap("token-keyword", m));
    text = text.replace(/\b(\d+(\.\d+)?)(px|rem|em|vh|vw|%|fr)?\b/g, (m) => wrap("token-number", m));
    text = text.replace(/[{}();:,]/g, (m) => wrap("token-punctuation", m));
    return store.pull(text);
}

function highlightJson(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/"([^"\\]|\\.)*"/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/@@TOKEN_(\d+)@@(?=\s*:)/g, (m) => wrap("token-property", m));
    text = text.replace(/\b(true|false|null)\b/g, (m) => wrap("token-keyword", m));
    text = text.replace(/\b-?\d+(\.\d+)?\b/g, (m) => wrap("token-number", m));
    text = text.replace(/[{}[\]:,]/g, (m) => wrap("token-punctuation", m));
    return store.pull(text);
}

function highlightSql(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/--.*$/gm, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/"[^"]*"|'[^']*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/\b(select|from|where|insert|into|update|delete|create|table|alter|drop|join|left|right|inner|outer|group|by|order|limit|values|set|and|or|as|on)\b/gi, (m) => wrap("token-keyword", m.toUpperCase()));
    text = text.replace(/\b-?\d+(\.\d+)?\b/g, (m) => wrap("token-number", m));
    text = text.replace(/[(),.;]/g, (m) => wrap("token-punctuation", m));
    return store.pull(text);
}

function highlightShell(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/^\s*#.*$/gm, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/"[^"]*"|'[^']*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/(^|\n)(\s*)([a-zA-Z][\w.-]*)(?=(\s|$))/g, (_, nl, sp, cmd) => `${nl}${sp}${wrap("token-command", cmd)}`);
    text = text.replace(/\s(-{1,2}[\w-]+)/g, (_, flag) => ` ${wrap("token-keyword", flag)}`);
    text = text.replace(/[|]/g, (m) => wrap("token-punctuation", m));
    return store.pull(text);
}

function highlightJavaScript(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/\/\/.*$/gm, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/`[\s\S]*?`|"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|async|await|try|catch|finally|throw|class|extends|import|from|export|default|null|true|false)\b/g, (m) => store.push(wrap("token-keyword", m)));
    text = text.replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, (m) => store.push(wrap("token-function", m)));
    text = text.replace(/\b-?\d+(\.\d+)?\b/g, (m) => store.push(wrap("token-number", m)));
    text = text.replace(/\b(document|window|console|fetch)\b/g, (m) => store.push(wrap("token-type", m)));
    text = text.replace(/\b([A-Za-z_$][\w$]*)(?=\s*:)/g, (m) => store.push(wrap("token-property", m)));
    text = text.replace(/[{}()[\].,;:+\-*/=<>!&|]/g, (m) => store.push(wrap("token-punctuation", m)));
    return store.pull(text);
}

function highlightJava(raw) {
    const store = createStore();
    let text = escapeHtml(raw);
    text = text.replace(/\/\/.*$/gm, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/\/\*[\s\S]*?\*\//g, (m) => store.push(wrap("token-comment", m)));
    text = text.replace(/"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g, (m) => store.push(wrap("token-string", m)));
    text = text.replace(/@\w+/g, (m) => store.push(wrap("token-annotation", m)));
    text = text.replace(/\b(public|private|protected|class|interface|enum|static|final|void|new|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|throws|package|import|extends|implements|null|true|false)\b/g, (m) => store.push(wrap("token-keyword", m)));
    text = text.replace(/\b(String|Integer|Long|Double|Float|Boolean|List|Map|Set|Object|void|int|long|double|float|boolean|char|byte|Short|HttpClient|HttpRequest|HttpResponse|URI)\b/g, (m) => store.push(wrap("token-type", m)));
    text = text.replace(/\b([A-Za-z_]\w*)(?=\s*\()/g, (m) => store.push(wrap("token-function", m)));
    text = text.replace(/\b-?\d+(\.\d+)?\b/g, (m) => store.push(wrap("token-number", m)));
    text = text.replace(/[{}()[\].,;:+\-*/=<>!&|]/g, (m) => store.push(wrap("token-punctuation", m)));
    return store.pull(text);
}

function highlightPlain(raw) {
    return safeEntityHighlight(escapeHtml(raw));
}

function highlightCode(raw, lang) {
    if (lang === "html") return highlightHtml(raw);
    if (lang === "css") return highlightCss(raw);
    if (lang === "json") return highlightJson(raw);
    if (lang === "sql") return highlightSql(raw);
    if (lang === "shell") return highlightShell(raw);
    if (lang === "javascript") return highlightJavaScript(raw);
    if (lang === "java") return highlightJava(raw);
    return highlightPlain(raw);
}

function looksLikePseudoFlow(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 3) return false;
    const arrowLines = lines.filter((line) => line.includes("->") || line.includes("=>")).length;
    const hasBraces = /[{}();]/.test(text);
    return arrowLines >= 2 && !hasBraces;
}

function detectCodeLanguage(codeText, pageName, titleText = "") {
    const text = codeText.trim();
    const page = pageName.toLowerCase();
    const title = titleText.toLowerCase();

    if (!text) return "text";
    if (looksLikePseudoFlow(text)) return "text";
    if (/^&lt;[a-z!/]|^<[a-z!/]/i.test(text) || /<\/[a-z]+>/i.test(text)) return "html";
    if (/^\s*[@\w\s<>[\]]+\s+class\s+\w+|@RestController|@GetMapping|System\.out|public\s+static\s+void/m.test(text)) return "java";
    if (/^\s*(const|let|var)\s+\w+|document\.|fetch\(|async function|console\.log|addEventListener\(/m.test(text)) return "javascript";
    if (/^\s*(git\s+\w+|cd\s+|ls$|mkdir\s+|code\s+\.)/m.test(text)) return "shell";
    if (/^\s*(select|insert|update|delete|create|alter|drop)\b/im.test(text)) return "sql";
    if ((text.startsWith("{") || text.startsWith("[")) && /["'][\w-]+["']\s*:/.test(text)) return "json";
    if (/^[.#][\w-]+\s*\{|display\s*:|color\s*:|margin\s*:|padding\s*:/m.test(text)) return "css";

    if (page.includes("tutorial-html")) return "html";
    if (page.includes("tutorial-css")) return "css";
    if (page.includes("tutorial-javascript")) return "javascript";
    if (page.includes("tutorial-java") || page.includes("tutorial-springboot")) return "java";
    if (page.includes("tutorial-basic-tools") || title.includes("命令")) return "shell";
    return "text";
}

async function copyCodeText(text, button) {
    const fallbackCopy = () => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "readonly");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
    };

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            fallbackCopy();
        }
        button.classList.add("is-copied");
        window.setTimeout(() => button.classList.remove("is-copied"), 1600);
    } catch {
        fallbackCopy();
        button.classList.add("is-copied");
        window.setTimeout(() => button.classList.remove("is-copied"), 1600);
    }
}

function enhanceCodeExamples(pageShell) {
    const pageName = getCurrentPage();
    const examples = Array.from(pageShell.querySelectorAll(".example"));

    examples.forEach((example) => {
        if (example.dataset.codeEnhanced === "true") return;
        const code = example.querySelector("pre code");
        const pre = example.querySelector("pre");
        if (!code || !pre) return;

        const heading = example.querySelector("h5");
        const explicitLang = example.dataset.lang || code.dataset.lang || pre.dataset.lang;
        const lang = explicitLang || detectCodeLanguage(code.textContent, pageName, heading ? heading.textContent : "");
        const rawCode = code.textContent;

        const meta = document.createElement("div");
        meta.className = "code-meta";
        meta.innerHTML = `
            <span class="code-lang-chip">${CODE_LANGUAGE_LABELS[lang] || lang}</span>
            <button type="button" class="code-copy" aria-label="复制代码">
                <i class="ti ti-copy"></i>
            </button>
        `;

        const copyButton = meta.querySelector(".code-copy");
        const copyIcon = meta.querySelector(".code-copy i");
        copyButton.addEventListener("click", () => {
            copyCodeText(rawCode, copyButton).then(() => {
                if (copyButton.classList.contains("is-copied")) {
                    copyIcon.className = "ti ti-check";
                    window.setTimeout(() => {
                        copyIcon.className = "ti ti-copy";
                    }, 1600);
                }
            });
        });

        code.innerHTML = highlightCode(rawCode, lang);
        code.classList.add(`language-${lang}`);
        pre.classList.add("code-block");
        example.classList.add("is-code-example");
        example.dataset.codeEnhanced = "true";

        if (heading) heading.remove();
        example.insertBefore(meta, pre);
    });
}

function buildSidebar(currentPage) {
    const aside = document.createElement("aside");
    aside.className = "docs-sidebar";

    DOC_GROUPS.forEach((group) => {
        const block = document.createElement("section");
        block.className = "docs-nav-group";
        const hasActive = group.items.some((item) => item.href === currentPage);
        if (hasActive) {
            block.classList.add("is-open");
        }

        const title = document.createElement("button");
        title.className = "docs-nav-title";
        title.type = "button";
        title.setAttribute("aria-expanded", hasActive ? "true" : "false");
        title.innerHTML = `
            <span>${group.title}</span>
            <i class="ti ti-chevron-right"></i>
        `;

        const list = document.createElement("ul");
        list.className = "docs-nav-list";

        group.items.forEach((item) => {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.className = "docs-nav-link";
            link.href = item.href;
            link.textContent = item.label;
            if (item.href === currentPage) {
                link.classList.add("active");
            }
            li.appendChild(link);
            list.appendChild(li);
        });

        title.addEventListener("click", () => {
            const willOpen = !block.classList.contains("is-open");
            block.classList.toggle("is-open", willOpen);
            title.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });

        block.appendChild(title);
        block.appendChild(list);
        aside.appendChild(block);
    });

    return aside;
}

function collectTocHeadings(pageShell) {
    const headings = Array.from(pageShell.querySelectorAll(".panel h3, .panel h4"));
    return headings
        .map((heading, index) => {
            if (!heading.id) heading.id = slugifyHeading(heading.textContent || "", index);
            return heading;
        })
        .filter((heading) => heading.textContent && heading.textContent.trim());
}

function buildToc(tocNav, headings) {
    tocNav.innerHTML = "";
    headings.forEach((heading) => {
        const link = document.createElement("a");
        link.className = "docs-toc-link";
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent.trim();
        link.dataset.target = heading.id;
        link.dataset.level = heading.tagName.toLowerCase();
        tocNav.appendChild(link);
    });
}

function syncActiveToc(headings, tocNav) {
    if (!headings.length) return;

    const update = () => {
        let activeId = headings[0].id;
        headings.forEach((heading) => {
            const rect = heading.getBoundingClientRect();
            if (rect.top <= 140) activeId = heading.id;
        });
        tocNav.querySelectorAll(".docs-toc-link").forEach((link) => {
            link.classList.toggle("active", link.dataset.target === activeId);
        });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
}

function buildLayout() {
    const pageShell = document.querySelector(".page-shell");
    if (!pageShell || pageShell.dataset.docHome === "true") return;

    const topbar = pageShell.querySelector(".topbar");
    if (!topbar) return;

    document.body.classList.add("docs-body");

    const layout = document.createElement("div");
    layout.className = "docs-layout";

    const content = document.createElement("div");
    content.className = "docs-content";

    const main = document.createElement("main");
    main.className = "docs-main";

    const currentPage = getCurrentPage();
    const sidebar = buildSidebar(currentPage);
    const toc = document.createElement("aside");
    toc.className = "docs-toc";
    toc.innerHTML = `
        <div class="docs-toc-inner">
            <div class="docs-toc-title">目录</div>
            <nav class="docs-toc-nav"></nav>
        </div>
    `;

    pageShell.parentNode.insertBefore(layout, pageShell);
    pageShell.removeChild(topbar);
    layout.appendChild(topbar);
    layout.appendChild(content);
    content.appendChild(sidebar);
    content.appendChild(main);
    content.appendChild(toc);
    main.appendChild(pageShell);

    enhanceCodeExamples(pageShell);

    const headings = collectTocHeadings(pageShell);
    const tocNav = toc.querySelector(".docs-toc-nav");
    if (headings.length) {
        buildToc(tocNav, headings);
        syncActiveToc(headings, tocNav);
    } else {
        toc.classList.add("is-empty");
    }
}

function applyTheme(theme) {
    const themeToggle = document.getElementById("page-theme-toggle");
    const themeIcon = themeToggle ? themeToggle.querySelector("i") : null;

    document.body.classList.remove("site-theme-light", "site-theme-dark");
    if (theme === "dark") {
        document.body.classList.add("site-theme-dark");
        if (themeIcon) themeIcon.className = "ti ti-moon";
    } else {
        document.body.classList.add("site-theme-light");
        if (themeIcon) themeIcon.className = "ti ti-sun";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    buildLayout();

    const pageShell = document.querySelector(".page-shell");
    if (pageShell && pageShell.dataset.docHome === "true") {
        enhanceCodeExamples(pageShell);
    }

    const savedTheme = localStorage.getItem("theme");
    applyTheme(savedTheme === "light" ? "light" : "dark");

    const themeToggle = document.getElementById("page-theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const nextTheme = document.body.classList.contains("site-theme-dark") ? "light" : "dark";
            localStorage.setItem("theme", nextTheme);
            applyTheme(nextTheme);
        });
    }
});
