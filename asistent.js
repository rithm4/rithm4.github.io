/*
 * Asistentul MoreLeads pe site (bulina de chat din colț). Se pune în head-ul site-ului:
 *   <script src="https://crm.moreleads.ro/asistent.js" data-key="CHEIA" async></script>
 * Vorbește cu funcția `site-chat` din CRM (Claude). Stilurile stau într-un Shadow DOM, ca să nu atingă site-ul.
 * Conversația rămâne în browserul vizitatorului (localStorage), ca să continue de pe altă pagină.
 */
(function () {
  "use strict";
  var script = document.currentScript || document.querySelector('script[src*="asistent.js"][data-key]');
  if (!script || window.__moreleadsAssistant) return;
  window.__moreleadsAssistant = true;
  var KEY = script.getAttribute("data-key") || "";
  var API = script.getAttribute("data-api") || "https://uarmqqfugpitwtyorpun.supabase.co/functions/v1/site-chat";
  if (!/^[0-9a-f]{32}$/.test(KEY)) return;

  var lang = (document.documentElement.lang || navigator.language || "ro").slice(0, 2).toLowerCase();
  var T = {
    ro: { name: "Asistent", placeholder: "Scrieți un mesaj…", send: "Trimite", open: "Deschide chatul", close: "Închide", online: "Răspunde imediat", hello: "Bună ziua! Cu ce vă pot ajuta?", error: "Mesajul nu a ajuns. Încercați din nou." },
    ru: { name: "Ассистент", placeholder: "Напишите сообщение…", send: "Отправить", open: "Открыть чат", close: "Закрыть", online: "Отвечает сразу", hello: "Здравствуйте! Чем могу помочь?", error: "Сообщение не дошло. Попробуйте ещё раз." },
    en: { name: "Assistant", placeholder: "Write a message…", send: "Send", open: "Open chat", close: "Close", online: "Replies instantly", hello: "Hello! How can I help you?", error: "The message didn't go through. Please try again." },
    de: { name: "Assistent", placeholder: "Nachricht schreiben…", send: "Senden", open: "Chat öffnen", close: "Schließen", online: "Antwortet sofort", hello: "Guten Tag! Wie kann ich Ihnen helfen?", error: "Die Nachricht kam nicht an. Bitte erneut versuchen." },
    it: { name: "Assistente", placeholder: "Scrivi un messaggio…", send: "Invia", open: "Apri la chat", close: "Chiudi", online: "Risponde subito", hello: "Buongiorno! Come posso aiutarla?", error: "Il messaggio non è arrivato. Riprovi." },
    es: { name: "Asistente", placeholder: "Escriba un mensaje…", send: "Enviar", open: "Abrir el chat", close: "Cerrar", online: "Responde al instante", hello: "¡Hola! ¿En qué puedo ayudarle?", error: "El mensaje no llegó. Inténtelo de nuevo." },
    fr: { name: "Assistant", placeholder: "Écrivez un message…", send: "Envoyer", open: "Ouvrir le chat", close: "Fermer", online: "Répond tout de suite", hello: "Bonjour ! Comment puis-je vous aider ?", error: "Le message n'est pas arrivé. Réessayez." },
  };
  var t = T[lang] || T.en;

  var store = "moreleads-chat-" + KEY;
  var state;
  try {
    state = JSON.parse(localStorage.getItem(store) || "null");
  } catch (e) {
    state = null;
  }
  if (!state || typeof state !== "object") state = {};
  if (!state.visitor) state.visitor = "v" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (!Array.isArray(state.messages)) state.messages = [];
  var save = function () {
    try {
      localStorage.setItem(store, JSON.stringify({ visitor: state.visitor, chat: state.chat || null, messages: state.messages.slice(-60), opened: state.opened }));
    } catch (e) {
      /* fereastră privată: conversația ține cât pagina */
    }
  };

  var config = { name: "Asistent", greeting: "", color: "#4f46e5", avatar: "" };

  /** Textul de pe culoarea site-ului: închis pe culori deschise (lime, galben), alb pe cele închise. */
  function inkOn(hex) {
    var n = parseInt(hex.slice(1), 16);
    var lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.62 ? "#10201c" : "#ffffff";
  }
  var host = document.createElement("div");
  host.style.cssText = "position:fixed;z-index:2147483000;right:0;bottom:0;width:0;height:0;";
  var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  /** Textul unui mesaj: linkuri și telefoane clicabile, rânduri păstrate; nimic din HTML-ul mesajului. */
  function render(text) {
    return escapeHtml(text)
      .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(\+?\d[\d\s().-]{7,}\d)/g, function (m, pre, num) {
        return pre + '<a href="tel:' + num.replace(/[^\d+]/g, "") + '">' + num + "</a>";
      })
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>");
  }

  function build() {
    var c = config.color || "#4f46e5";
    var ink = inkOn(c);
    var soft = ink === "#ffffff" ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.1)";
    root.innerHTML =
      "<style>" +
      ":host{all:initial}" +
      "*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}" +
      ".bubble{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:" + c + ";color:" + ink + ";display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,0,0,.22);transition:transform .16s ease-out}" +
      ".bubble:hover{transform:scale(1.05)}.bubble:active{transform:scale(.96)}" +
      ".bubble svg{width:28px;height:28px}" +
      ".dot{position:absolute;top:3px;right:3px;width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff}" +
      ".teaser{position:fixed;right:20px;bottom:92px;max-width:260px;background:#fff;color:#111;border-radius:16px;padding:12px 34px 12px 14px;font-size:14px;line-height:1.4;box-shadow:0 8px 28px rgba(0,0,0,.16);cursor:pointer;animation:in .25s ease-out}" +
      ".teaser .x{position:absolute;top:6px;right:8px;border:0;background:none;color:#888;font-size:18px;cursor:pointer;line-height:1}" +
      ".panel{position:fixed;right:20px;bottom:92px;width:370px;height:min(580px,calc(100vh - 120px));background:#fff;color:#111;border-radius:20px;box-shadow:0 16px 48px rgba(0,0,0,.24);display:flex;flex-direction:column;overflow:hidden;animation:in .2s ease-out}" +
      "@keyframes in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}" +
      ".head{background:" + c + ";color:" + ink + ";padding:14px 16px;display:flex;align-items:center;gap:10px}" +
      ".avatar{width:42px;height:42px;border-radius:50%;background:" + soft + ";display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;flex-shrink:0;overflow:hidden}" +
      ".avatar img,.teaser img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".teaser.photo{padding-left:58px;min-height:60px}.teaser .pic{position:absolute;left:10px;top:10px;width:40px;height:40px;border-radius:50%;overflow:hidden}" +
      ".who{flex:1;min-width:0}.who b{display:block;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".who span{font-size:12px;opacity:.85}.who span:before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;margin-right:5px}" +
      ".close{border:0;background:" + soft + ";color:" + ink + ";width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px;line-height:1}" +
      ".list{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:8px;background:#f7f7f9}" +
      ".msg{max-width:84%;padding:9px 13px;border-radius:16px;font-size:14px;line-height:1.45;overflow-wrap:anywhere}" +
      ".msg a{color:inherit;text-decoration:underline}" +
      ".bot{align-self:flex-start;background:#fff;border:1px solid #ececf0;border-bottom-left-radius:5px}" +
      ".me{align-self:flex-end;background:" + c + ";color:" + ink + ";border-bottom-right-radius:5px}" +
      ".typing{align-self:flex-start;background:#fff;border:1px solid #ececf0;border-radius:16px;padding:12px 14px;display:flex;gap:4px}" +
      ".typing i{width:7px;height:7px;border-radius:50%;background:#aaa;animation:b 1s infinite}.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}" +
      "@keyframes b{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}" +
      ".err{align-self:center;font-size:12px;color:#b91c1c}" +
      ".form{display:flex;gap:8px;padding:10px;border-top:1px solid #ececf0;background:#fff}" +
      ".form textarea{flex:1;resize:none;border:1px solid #e2e2e8;border-radius:14px;padding:10px 12px;font-size:14px;line-height:1.35;max-height:110px;outline:none;color:#111;background:#fff}" +
      ".form textarea:focus{border-color:" + (ink === "#ffffff" ? c : "#10201c") + "}" +
      ".send{width:42px;height:42px;border-radius:50%;border:0;background:" + c + ";color:" + ink + ";cursor:pointer;flex-shrink:0;align-self:flex-end;display:flex;align-items:center;justify-content:center}" +
      ".send:disabled{opacity:.45;cursor:default}.send svg{width:18px;height:18px}" +
      "@media (max-width:480px){.panel{left:0;right:0;top:0;bottom:auto;width:100%;height:100dvh;max-height:none;border-radius:0;animation:none}.form textarea{font-size:16px}.msg{font-size:15px}.bubble{right:16px;bottom:16px}.teaser{right:16px;bottom:86px}}" +
      "</style>" +
      '<button class="bubble" aria-label="' + escapeHtml(t.open) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></button>';
    root.querySelector(".bubble").addEventListener("click", function () {
      state.opened ? closePanel() : openPanel();
    });
  }

  var panel = null;
  var sending = false;

  function addMessage(role, text) {
    state.messages.push({ role: role, text: text });
    save();
    if (panel) paint();
  }

  function paint() {
    var list = panel.querySelector(".list");
    var html = "";
    var greeting = config.greeting || t.hello;
    html += '<div class="msg bot">' + render(greeting) + "</div>";
    state.messages.forEach(function (m) {
      html += '<div class="msg ' + (m.role === "user" ? "me" : "bot") + '">' + render(m.text) + "</div>";
    });
    if (sending) html += '<div class="typing"><i></i><i></i><i></i></div>';
    list.innerHTML = html;
    list.scrollTop = list.scrollHeight;
  }

  function openPanel() {
    state.opened = true;
    save();
    var teaser = root.querySelector(".teaser");
    if (teaser) teaser.remove();
    var dot = root.querySelector(".dot");
    if (dot) dot.remove();
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", config.name);
    panel.innerHTML =
      '<div class="head"><div class="avatar">' + (config.avatar ? '<img alt="" src="' + config.avatar + '">' : escapeHtml((config.name || "A").trim().charAt(0).toUpperCase())) + '</div><div class="who"><b>' + escapeHtml(config.name) + "</b><span>" + escapeHtml(t.online) + '</span></div><button class="close" aria-label="' + escapeHtml(t.close) + '">×</button></div>' +
      '<div class="list" aria-live="polite"></div>' +
      '<form class="form"><textarea rows="1" maxlength="1000" placeholder="' + escapeHtml(t.placeholder) + '"></textarea><button class="send" type="submit" aria-label="' + escapeHtml(t.send) + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>';
    root.appendChild(panel);
    panel.querySelector(".close").addEventListener("click", closePanel);
    var area = panel.querySelector("textarea");
    var form = panel.querySelector("form");
    area.addEventListener("input", function () {
      area.style.height = "auto";
      area.style.height = Math.min(area.scrollHeight, 110) + "px";
    });
    area.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit ? form.requestSubmit() : send();
      }
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      send();
    });
    paint();
    if (window.innerWidth > 480) area.focus();
    fit();
  }

  /**
   * Telefon: fereastra chatului ține cât partea de ecran care se vede (fără tastatură) și rămâne lipită de ea, ca
   * antetul și mesajele să nu fugă sub tastatură pe iPhone; pagina de dedesubt nu se mai derulează cât e deschis.
   */
  function fit() {
    var vv = window.visualViewport;
    var phone = window.innerWidth <= 480;
    document.documentElement.style.overflow = panel && phone ? "hidden" : "";
    // pe telefon chatul e pe tot ecranul: butonul rotund ar sta peste „Trimite” (se închide din × de sus)
    var bubble = root.querySelector(".bubble");
    if (bubble) bubble.style.display = panel && phone ? "none" : "";
    if (!panel) return;
    if (!phone || !vv) {
      panel.style.height = "";
      panel.style.top = "";
      return;
    }
    panel.style.height = vv.height + "px";
    panel.style.top = vv.offsetTop + "px";
    var list = panel.querySelector(".list");
    if (list) list.scrollTop = list.scrollHeight;
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", fit);
    window.visualViewport.addEventListener("scroll", fit);
  }
  window.addEventListener("resize", fit);

  function closePanel() {
    state.opened = false;
    save();
    if (panel) panel.remove();
    panel = null;
    fit();
  }

  function send() {
    if (!panel || sending) return;
    var area = panel.querySelector("textarea");
    var text = area.value.trim();
    if (!text) return;
    area.value = "";
    area.style.height = "auto";
    addMessage("user", text);
    sending = true;
    paint();
    panel.querySelector(".send").disabled = true;
    fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ k: KEY, chat: state.chat || null, visitor: state.visitor, text: text, page: location.href, lang: lang }),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        sending = false;
        if (data && data.chat) state.chat = data.chat;
        if (data && data.reply) addMessage("assistant", data.reply);
        else throw new Error("fără răspuns");
      })
      .catch(function () {
        sending = false;
        if (panel) {
          paint();
          var err = document.createElement("div");
          err.className = "err";
          err.textContent = t.error;
          panel.querySelector(".list").appendChild(err);
        }
      })
      .then(function () {
        if (panel) panel.querySelector(".send").disabled = false;
      });
  }

  function start() {
    fetch(API + "?k=" + KEY)
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !data.name) return;
        config = { name: !data.name || data.name === "Asistent" ? t.name : data.name, greeting: data.greeting || "", color: /^#[0-9a-f]{6}$/i.test(data.color || "") ? data.color : "#4f46e5", avatar: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.avatar || "") ? data.avatar : "" };
        document.body.appendChild(host);
        build();
        if (state.opened) openPanel();
        else if (!state.messages.length) {
          // salutul apare singur după câteva secunde, o dată pe sesiune
          var shown = false;
          try {
            shown = sessionStorage.getItem(store + "-teaser") === "1";
          } catch (e) {
            shown = false;
          }
          if (!shown)
            setTimeout(function () {
              if (state.opened || root.querySelector(".teaser")) return;
              var teaser = document.createElement("div");
              teaser.className = config.avatar ? "teaser photo" : "teaser";
              teaser.innerHTML = (config.avatar ? '<span class="pic"><img alt="" src="' + config.avatar + '"></span>' : "") + render(config.greeting || t.hello) + '<button class="x" aria-label="' + escapeHtml(t.close) + '">×</button>';
              teaser.addEventListener("click", function (e) {
                if (e.target.className === "x") {
                  teaser.remove();
                  var d = root.querySelector(".dot");
                  if (d) d.remove();
                }
                else openPanel();
              });
              root.appendChild(teaser);
              var dot = document.createElement("span");
              dot.className = "dot";
              root.querySelector(".bubble").appendChild(dot);
              try {
                sessionStorage.setItem(store + "-teaser", "1");
              } catch (e) {
                /* fără sessionStorage: salutul poate reapărea */
              }
            }, 5000);
        }
      })
      .catch(function () {
        /* asistentul nu e pornit sau site-ul nu e permis: nu arătăm nimic */
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
