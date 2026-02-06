const htmlEditor = document.getElementById("htmlEditor");
const cssEditor = document.getElementById("cssEditor");
const jsEditor = document.getElementById("jsEditor");
const previewFrame = document.getElementById("previewFrame");
const applyButton = document.getElementById("applyButton");
const screenshotButton = document.getElementById("screenshotButton");
const toast = document.getElementById("toast");
const captureRoot = document.getElementById("captureRoot");
const tabButtons = document.querySelectorAll(".tab-button");
const previewFrameWrapper = document.querySelector(".preview-frame");
const saveNameInput = document.getElementById("saveName");
const saveButton = document.getElementById("saveButton");
const loadButton = document.getElementById("loadButton");
const deleteButton = document.getElementById("deleteButton");
const saveSelect = document.getElementById("saveSelect");

const DRAFT_KEY = "quicklayout_draft";
const SAVES_KEY = "quicklayout_saves";
const MAX_SAVES = 10;
const MAX_SIZE = 300 * 1024;

let latestCombinedHtml = "";
let activeTab = "pc";
let draftTimer = null;

const sample = {
  html: "<div class=\"card\">\n  <h2>QuickLayout サンプル</h2>\n  <p>HTML / CSS / JS を入力して \"反映\" を押してください。</p>\n  <button id=\"helloButton\">クリック</button>\n</div>",
  css: ".card {\n  max-width: 420px;\n  margin: 40px auto;\n  padding: 24px;\n  background: #ffffff;\n  border-radius: 16px;\n  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.12);\n  font-family: 'Helvetica Neue', sans-serif;\n}\n\n.card h2 {\n  margin-top: 0;\n}\n\n#helloButton {\n  padding: 10px 16px;\n  border-radius: 999px;\n  border: none;\n  background: #2563eb;\n  color: #fff;\n  cursor: pointer;\n}",
  js: "document.getElementById('helloButton')?.addEventListener('click', () => {\n  alert('こんにちは！');\n});",
};

const formatDateLabel = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const formatFileStamp = () => {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove("show"), 2500);
};

const escapeScript = (code) => code.replace(/<\//g, "<\\/");

const buildCombinedHtml = ({ html, css, js }) => {
  const safeJs = escapeScript(js);
  return `<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<style>${css}</style>\n</head>\n<body>\n${html}\n<script>${safeJs}<\\/script>\n</body>\n</html>`;
};

const applyPreview = () => {
  const html = htmlEditor.value;
  const css = cssEditor.value;
  const js = jsEditor.value;
  latestCombinedHtml = buildCombinedHtml({ html, css, js });
  previewFrame.srcdoc = latestCombinedHtml;
  showToast("プレビューに反映しました");
};

const scheduleDraftSave = () => {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const draft = {
      html: htmlEditor.value,
      css: cssEditor.value,
      js: jsEditor.value,
      updatedAt: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, 1200);
};

const loadDraftOrSample = () => {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw) {
    try {
      const draft = JSON.parse(raw);
      htmlEditor.value = draft.html || "";
      cssEditor.value = draft.css || "";
      jsEditor.value = draft.js || "";
      return;
    } catch (error) {
      localStorage.removeItem(DRAFT_KEY);
    }
  }
  htmlEditor.value = sample.html;
  cssEditor.value = sample.css;
  jsEditor.value = sample.js;
};

const getSaves = () => {
  const raw = localStorage.getItem(SAVES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (error) {
    localStorage.removeItem(SAVES_KEY);
    return [];
  }
};

const setSaves = (list) => {
  localStorage.setItem(SAVES_KEY, JSON.stringify(list));
  refreshSaveList();
};

const refreshSaveList = () => {
  const saves = getSaves();
  saveSelect.innerHTML = "<option value=\"\">-- 選択してください --</option>";
  saves.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.name}（${item.updatedAtLabel}）`;
    saveSelect.appendChild(option);
  });
};

const calcSize = (html, css, js) => new Blob([html, css, js]).size;

const saveEntry = () => {
  const html = htmlEditor.value;
  const css = cssEditor.value;
  const js = jsEditor.value;
  const size = calcSize(html, css, js);
  if (size > MAX_SIZE) {
    showToast("1件の上限サイズ(300KB)を超えました");
    return;
  }

  const name = saveNameInput.value.trim() || formatDateLabel();
  const saves = getSaves();
  const existing = saves.find((item) => item.name === name);

  if (existing) {
    if (!window.confirm("同名の保存があります。上書きしますか？")) {
      return;
    }
    existing.html = html;
    existing.css = css;
    existing.js = js;
    existing.updatedAt = Date.now();
    existing.updatedAtLabel = formatDateLabel();
    setSaves(saves);
    showToast("保存を上書きしました");
    return;
  }

  if (saves.length >= MAX_SAVES) {
    showToast("保存が10件満杯です。上書きか削除を行ってください");
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    name,
    html,
    css,
    js,
    updatedAt: Date.now(),
    updatedAtLabel: formatDateLabel(),
  };
  saves.unshift(entry);
  setSaves(saves);
  showToast("保存しました");
};

const loadEntry = () => {
  const targetId = saveSelect.value;
  if (!targetId) {
    showToast("読み込み対象を選んでください");
    return;
  }
  const saves = getSaves();
  const entry = saves.find((item) => item.id === targetId);
  if (!entry) {
    showToast("保存データが見つかりません");
    return;
  }
  htmlEditor.value = entry.html;
  cssEditor.value = entry.css;
  jsEditor.value = entry.js;
  scheduleDraftSave();
  showToast("エディタに読み込みました。反映ボタンを押してください");
};

const deleteEntry = () => {
  const targetId = saveSelect.value;
  if (!targetId) {
    showToast("削除対象を選んでください");
    return;
  }
  if (!window.confirm("この保存データを削除しますか？")) {
    return;
  }
  const saves = getSaves();
  const next = saves.filter((item) => item.id !== targetId);
  setSaves(next);
  showToast("削除しました");
};

const updateTab = (tab) => {
  activeTab = tab;
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  previewFrameWrapper.dataset.view = tab;
};

const renderForScreenshot = () => {
  const html = htmlEditor.value;
  const css = cssEditor.value;
  const js = jsEditor.value;

  const safeHtml = html;
  const safeCss = css;
  const safeJs = js;

  captureRoot.innerHTML = "";

  const container = document.createElement("div");
  container.style.width = activeTab === "sp" ? "375px" : "";
  container.style.minHeight = "1px";
  container.innerHTML = `<style>${safeCss}</style>${safeHtml}`;
  captureRoot.appendChild(container);

  const script = document.createElement("script");
  script.textContent = safeJs;
  container.appendChild(script);

  return container;
};

const takeScreenshot = async () => {
  if (!latestCombinedHtml) {
    showToast("先に反映ボタンを押してください");
    return;
  }

  if (!window.html2canvas) {
    showToast("スクショ機能の読み込みに失敗しました");
    return;
  }

  let target;
  try {
    target = renderForScreenshot();
    const canvas = await window.html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
    const stamp = formatFileStamp();
    const filename = activeTab === "sp" ? `quicklayout_sp_${stamp}.png` : `quicklayout_pc_${stamp}.png`;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = filename;
    link.click();
    showToast("スクショを保存しました");
  } catch (error) {
    showToast("スクショに失敗しました（外部リソースが原因の可能性）");
  } finally {
    captureRoot.innerHTML = "";
  }
};

applyButton.addEventListener("click", applyPreview);

[htmlEditor, cssEditor, jsEditor].forEach((editor) => {
  editor.addEventListener("input", scheduleDraftSave);
});

saveButton.addEventListener("click", saveEntry);
loadButton.addEventListener("click", loadEntry);
deleteButton.addEventListener("click", deleteEntry);

screenshotButton.addEventListener("click", takeScreenshot);

saveSelect.addEventListener("change", () => {
  const saves = getSaves();
  const entry = saves.find((item) => item.id === saveSelect.value);
  if (entry) {
    saveNameInput.value = entry.name;
  }
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => updateTab(button.dataset.tab));
});

loadDraftOrSample();
refreshSaveList();
updateTab("pc");
