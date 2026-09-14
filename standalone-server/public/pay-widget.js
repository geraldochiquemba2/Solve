/* Solve CRM — Widget de pagamento para a Cademi (SamoraFit)
 * Uso na Cademi (Código personalizado, <head>):
 *   <script src="https://solve-sqoh.onrender.com/pay-widget.js"></script>
 * Opcional antes do script:
 *   <script>window.SOLVE_PAY_API = "https://solve-sqoh.onrender.com";</script>
 */
(function () {
  var API = (window.SOLVE_PAY_API || "https://solve-sqoh.onrender.com").replace(/\/$/, "");
  var API_KEY = "solve-crm-api-key-2024";
  var RED = "#D71920";

  function h(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "X-API-Key": API_KEY }, opts.headers || {});
    return fetch(url, opts);
  }

  function css() {
    var s = document.createElement("style");
    s.textContent =
      ".spw-btn{position:fixed;bottom:20px;right:20px;background:" + RED + ";color:#fff;padding:14px 18px;border-radius:50px;font-weight:700;border:0;cursor:pointer;z-index:99999;font-family:sans-serif;font-size:15px;box-shadow:0 8px 25px rgba(215,25,32,.35)}" +
      ".spw-back{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:1rem}" +
      ".spw-modal{background:#fff;border-radius:14px;max-width:420px;width:100%;padding:1.2rem;font-family:sans-serif;color:#111;max-height:calc(100vh - 2rem);overflow:auto}" +
      ".spw-modal h3{margin:0 0 .2rem;font-size:1.05rem}" +
      ".spw-note{font-size:.75rem;color:#666;margin-bottom:.9rem}" +
      ".spw-label{display:block;font-size:.72rem;font-weight:700;margin:.6rem 0 .3rem}" +
      ".spw-input,.spw-select{width:100%;border:1px solid #d4d4d8;border-radius:8px;padding:.6rem .7rem;font-size:.85rem;box-sizing:border-box;background:#fff;color:#111}" +
      ".spw-row{display:flex;gap:.5rem}.spw-row>div{flex:1}" +
      ".spw-msg{font-size:.78rem;margin-top:.6rem}" +
      ".spw-actions{display:flex;gap:.5rem;margin-top:1rem}" +
      ".spw-pay{flex:1;background:" + RED + ";color:#fff;border:0;border-radius:8px;padding:.65rem;font-weight:700;cursor:pointer;font-size:.85rem}" +
      ".spw-pay:disabled{opacity:.6;cursor:wait}" +
      ".spw-close{flex:1;background:#f4f4f5;color:#111;border:1px solid #e4e4e7;border-radius:8px;padding:.65rem;font-weight:600;cursor:pointer;font-size:.85rem}" +
      ".spw-methods{display:flex;gap:.5rem;margin-top:.3rem}" +
      ".spw-methods button{flex:1;border:1px solid #d4d4d8;background:#fff;border-radius:8px;padding:.55rem;cursor:pointer;font-size:.8rem;font-weight:600;color:#111}" +
      ".spw-methods button.on{background:#111;color:#fff;border-color:#111}" +
      ".spw-ref{background:#f4f4f5;border-radius:8px;padding:.7rem;margin-top:.7rem;font-size:.82rem}" +
      ".spw-ref b{font-size:1rem;letter-spacing:.03em}";
    document.head.appendChild(s);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function checkStatus(code) {
    try {
      var r = await h(API + "/api/v1/payments/ekwanza/check-status/" + encodeURIComponent(code));
      return await r.json().catch(function () { return null; });
    } catch (e) { return null; }
  }

  function openModal(entregas) {
    closeModal();
    var back = el("div", "spw-back");
    var m = el("div", "spw-modal");
    back.appendChild(m);
    m.innerHTML =
      "<h3>Pagar mensalidade</h3>" +
      "<div class='spw-note'>SamoraFit · pagamento</div>" +
      "<label class='spw-label'>Conteúdo</label><select id='spw-prod' class='spw-select'></select>" +
      "<div class='spw-row'><div><label class='spw-label'>Montante (Kz) *</label><input id='spw-amt' class='spw-input' type='number' min='1'></div>" +
      "<div><label class='spw-label'>Método</label><div class='spw-methods'><button type='button' id='spw-m-exp' class='on'>Express</button><button type='button' id='spw-m-ref'>Referência</button></div></div></div>" +
      "<label class='spw-label'>Telefone *</label><input id='spw-phone' class='spw-input' placeholder='9XXXXXXXX'>" +
      "<div class='spw-row'><div><label class='spw-label'>Nome</label><input id='spw-name' class='spw-input' placeholder='Nome do aluno'></div>" +
      "<div><label class='spw-label'>Email</label><input id='spw-email' class='spw-input' type='email' placeholder='aluno@email.com'></div></div>" +
      "<div id='spw-msg' class='spw-msg'></div><div id='spw-ref'></div>" +
      "<div class='spw-actions'><button class='spw-close' id='spw-cancel'>Fechar</button><button class='spw-pay' id='spw-go'>Pagar</button></div>";
    document.body.appendChild(back);

    var sel = m.querySelector("#spw-prod");
    entregas.forEach(function (o) {
      var op = document.createElement("option");
      op.value = o.id;
      op.textContent = o.nome + (o.preco ? " — " + o.preco + " Kz" : "");
      sel.appendChild(op);
    });
    function syncAmt() {
      var f = null;
      entregas.forEach(function (o) { if (o.id === sel.value) f = o; });
      if (f && f.preco) m.querySelector("#spw-amt").value = f.preco;
    }
    sel.addEventListener("change", syncAmt);
    syncAmt();

    var method = "express";
    var bExp = m.querySelector("#spw-m-exp"), bRef = m.querySelector("#spw-m-ref");
    bExp.addEventListener("click", function () { method = "express"; bExp.className = "on"; bRef.className = ""; });
    bRef.addEventListener("click", function () { method = "referencia"; bRef.className = "on"; bExp.className = ""; });
    m.querySelector("#spw-cancel").addEventListener("click", closeModal);
    back.addEventListener("click", function (e) { if (e.target === back) closeModal(); });
    autodetect(m);
    m.querySelector("#spw-go").addEventListener("click", function () { pagar(m, method); });
  }

  function closeModal() {
    var b = document.querySelector(".spw-back");
    if (b) b.remove();
  }

  // Deteta o aluno logado na Cademi (nome/email/telefone visíveis na página) e preenche.
  // 1) perfil guardado pelo próprio widget (último pagamento neste browser)
  // 2) heurísticas da página. Devolve relatório para diagnóstico (?spw_debug=1).
  function autodetect(m) {
    var report = [];
    try {
      var nameEl = m.querySelector("#spw-name"), emailEl = m.querySelector("#spw-email"), phoneEl = m.querySelector("#spw-phone");
      try {
        var saved = JSON.parse(localStorage.getItem("spw_profile") || "null");
        if (saved) {
          if (!nameEl.value && saved.name) { nameEl.value = saved.name; report.push("memória: nome"); }
          if (!emailEl.value && saved.email) { emailEl.value = saved.email; report.push("memória: email"); }
          if (!phoneEl.value && saved.phone) { phoneEl.value = saved.phone; report.push("memória: telefone"); }
        }
      } catch (e0) {}
      var email = "";
      var mailto = document.querySelector('a[href^="mailto:"]');
      if (mailto) email = (mailto.getAttribute("href") || "").replace(/^mailto:/i, "").split("?")[0].trim();
      if (!email || email.indexOf("@") < 0) {
        var bodyTxt = (document.body.innerText || "").match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (bodyTxt) email = bodyTxt[0];
      }
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i) || "";
          var v = String(localStorage.getItem(k) || "");
          if (!email && /email|usuario|user|aluno/i.test(k) && v.indexOf("@") > 0 && v.length < 80) email = v.trim();
        }
      } catch (e) {}
      var name = "";
      var cands = document.querySelectorAll("header .user-name, header .username, .user-info .name, .profile-name, [class*='user-name'], [class*='username']");
      for (var j = 0; j < cands.length; j++) {
        var t = (cands[j].innerText || "").trim();
        if (t && t.indexOf("@") < 0 && t.length > 1 && t.length < 60) { name = t; break; }
      }
      if (!name) {
        var avatar = document.querySelector("header img[alt], .avatar[alt], .profile img[alt]");
        if (avatar) { var a = (avatar.getAttribute("alt") || "").trim(); if (a && a.indexOf("@") < 0 && a.length < 60) name = a; }
      }
      var phone = "";
      var tel = document.querySelector('a[href^="tel:"]');
      if (tel) phone = (tel.getAttribute("href") || "").replace(/^tel:/i, "").replace(/\D/g, "").slice(-9);
      if (!phone) {
        var telInput = document.querySelector('input[type="tel"]');
        if (telInput && telInput.value) phone = String(telInput.value).replace(/\D/g, "").slice(-9);
      }
      // Varrimento largo: inputs da página, dataLayer, JSON-LD, meta tags.
      try {
        if (!email || !name || !phone) {
          var inputs = document.querySelectorAll("input");
          for (var w = 0; w < inputs.length; w++) {
            var inp = inputs[w];
            var idn = ((inp.name || "") + " " + (inp.id || "") + " " + (inp.placeholder || "")).toLowerCase();
            var val = String(inp.value || "").trim();
            if (!val) continue;
            if (!email && val.indexOf("@") > 0 && val.length < 80 && /email|e-mail|mail|usuario|user|aluno|conta|login/.test(idn)) email = val;
            if (!phone && /tel|cel|fone|phone|whatsapp|numero|número/.test(idn)) {
              var dg = val.replace(/\D/g, "").slice(-9);
              if (dg.length === 9) phone = dg;
            }
            if (!name && /nome|name|aluno|usuario|user/.test(idn) && val.indexOf("@") < 0 && val.length < 60) name = val;
          }
        }
      } catch (e2) {}
      try {
        if ((!email || !name) && window.dataLayer && window.dataLayer.length) {
          var dl = JSON.stringify(window.dataLayer).slice(0, 20000);
          if (!email) { var me = dl.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/); if (me) email = me[0]; }
        }
      } catch (e3) {}
      try {
        var metas = document.querySelectorAll('meta[name="user-email"], meta[name="email"], meta[property="profile:email"]');
        for (var mI = 0; mI < metas.length && !email; mI++) {
          var mc = (metas[mI].getAttribute("content") || "").trim();
          if (mc.indexOf("@") > 0) email = mc;
        }
      } catch (e4) {}
      if (email && !emailEl.value) { emailEl.value = email; report.push("página: email"); }
      if (name && !nameEl.value) { nameEl.value = name; report.push("página: nome"); }
      if (phone && phone.length === 9 && !phoneEl.value) { phoneEl.value = phone; report.push("página: telefone"); }
      // Nome oficial: pergunta ao CRM (Cademi → CRM → OVG) pelo email.
      try {
        var em = (emailEl.value || "").trim();
        if (em && em.indexOf("@") > 0 && !nameEl.value) {
          h(API + "/api/v1/cademi/nome?email=" + encodeURIComponent(em)).then(function (r) { return r.json().catch(function () { return {}; }); }).then(function (j) {
            if (j && j.data && j.data.nome && !nameEl.value) nameEl.value = j.data.nome;
          }).catch(function () {});
        }
      } catch (e6) {}
      try {
        if (window.location.search.indexOf("spw_debug=1") >= 0) {
          var hdr = document.querySelector("header");
          var info = "achados: " + (report.join(", ") || "nenhum") +
            " | header: " + (hdr ? (hdr.innerText || "").trim().slice(0, 120) : "sem header") +
            " | inputs: " + document.querySelectorAll("input").length +
            " | mailto: " + (!!document.querySelector('a[href^="mailto:"]')) +
            " | dataLayer: " + (!!(window.dataLayer && window.dataLayer.length));
          var d = m.querySelector("#spw-msg");
          d.textContent = info;
          d.style.color = "#666";
        }
      } catch (e5) {}
    } catch (e) {}
  }

  function msg(m, t, err) {
    var d = m.querySelector("#spw-msg");
    d.textContent = t;
    d.style.color = err ? "#b91c1c" : "#15803d";
  }

  async function pagar(m, method) {
    var amt = parseFloat(m.querySelector("#spw-amt").value);
    var phone = m.querySelector("#spw-phone").value.trim();
    var name = m.querySelector("#spw-name").value.trim();
    var email = m.querySelector("#spw-email").value.trim();
    var prod = m.querySelector("#spw-prod").value;
    var btn = m.querySelector("#spw-go");
    if (!amt || amt <= 0) { msg(m, "Indica um montante válido.", true); return; }
    if (!phone) { msg(m, "Indica o número de telefone.", true); return; }
    btn.disabled = true;
    btn.textContent = "A gerar...";
    try {
      var r = await h(API + "/api/v1/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method: method === "express" ? "mcx_express" : "referencia", customer_phone: phone, customer_email: email || undefined, customer_name: name || undefined, cademi_produto: prod || undefined, description: "Pagamento via site Cademi" })
      });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.error || r.statusText);
      var code = (j.data && j.data.code) || "";
      try { localStorage.setItem("spw_profile", JSON.stringify({ name: name, email: email, phone: phone })); } catch (e9) {}
      if (method === "express") {
        msg(m, "Pedido enviado para " + phone + " (" + code + "). Aprova no Multicaixa...");
        for (var i = 0; i < 24; i++) {
          await sleep(5000);
          var st = await checkStatus(code);
          var s = st && (st.newStatus || st.currentStatus);
          if (s === "confirmado") { msg(m, "Pagamento confirmado. O curso liberta sozinho."); break; }
          if (s === "rejeitado") { msg(m, "Pagamento rejeitado/cancelado.", true); break; }
        }
      } else {
        msg(m, "A gerar referência (" + code + ")...");
        var ref = null;
        for (var k = 0; k < 12; k++) {
          await sleep(5000);
          var st2 = await checkStatus(code);
          if (st2 && st2.reference && st2.reference.referenceNumber) { ref = st2.reference; break; }
        }
        var box = m.querySelector("#spw-ref");
        if (ref) {
          box.innerHTML = "<div class='spw-ref'>Entidade: <b>" + (ref.entity || "—") + "</b><br>Referência: <b>" + ref.referenceNumber + "</b><br>Valor: <b>" + amt + " Kz</b><br><span style='font-size:.72rem;color:#666'>Paga no ATM/MCX. O curso liberta após pagamento.</span></div>";
          msg(m, "Referência gerada.");
        } else {
          msg(m, "Referência criada (" + code + "). Se os dados não aparecerem, fala connosco.", true);
        }
      }
    } catch (e) {
      msg(m, "Erro: " + (e.message || "falha"), true);
    }
    btn.disabled = false;
    btn.textContent = "Pagar";
  }

  async function boot() {
    css();
    // Memoriza o email digitado no login da Cademi (#AcessoEmail) para
    // pré-preencher o pagamento depois de entrar.
    try {
      var loginEmail = document.querySelector("#AcessoEmail");
      if (loginEmail) {
        var saveLogin = function () {
          var v = String(loginEmail.value || "").trim();
          if (v.indexOf("@") > 0) {
            try {
              var prev = JSON.parse(localStorage.getItem("spw_profile") || "{}");
              prev.email = v;
              localStorage.setItem("spw_profile", JSON.stringify(prev));
            } catch (e) {}
          }
        };
        loginEmail.addEventListener("change", saveLogin);
        var loginForm = loginEmail.closest("form");
        if (loginForm) loginForm.addEventListener("submit", saveLogin);
      }
    } catch (e) {}
    var b = el("button", "spw-btn", "💳 Pagar mensalidade");
    document.body.appendChild(b);
    var entregas = [{ id: "samorafit-workout", nome: "SamoraFit Workout" }];
    try {
      var r = await h(API + "/api/v1/cademi/entregas");
      var j = await r.json().catch(function () { return {}; });
      if (j && Array.isArray(j.data) && j.data.length) entregas = j.data;
    } catch (e) {}
    b.addEventListener("click", function () { openModal(entregas); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
