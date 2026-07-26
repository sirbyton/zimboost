(function () {
  var SUPABASE_URL = "https://ybncizxgvtfkngvjchgp.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_aonyZhP_jpv2CKRWAeEl9g_bmS_7igl";

  function getBrowserId() {
    var key = "zimboost_browser_id";
    var id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getInputByPlaceholder(text) {
    var inputs = document.querySelectorAll("input, textarea");
    for (var i = 0; i < inputs.length; i++) {
      var ph = (inputs[i].placeholder || "").toLowerCase();
      if (ph.includes(text.toLowerCase())) return inputs[i];
    }
    return null;
  }

  function getValueNearLabel(labelText) {
    var all = document.querySelectorAll("body *");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length === 0 && el.textContent.trim().toUpperCase() === labelText.toUpperCase()) {
        var parent = el.parentElement;
        if (parent) {
          var siblings = parent.querySelectorAll("*");
          for (var j = 0; j < siblings.length; j++) {
            if (siblings[j] !== el && siblings[j].children.length === 0 && siblings[j].textContent.trim() !== "") {
              return siblings[j].textContent.trim();
            }
          }
        }
      }
    }
    return "";
  }

  function findConfirmButton() {
    var buttons = document.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i++) {
      var t = (buttons[i].textContent || "").toUpperCase();
      if (t.includes("CONFIRM ORDER") || t.includes("CONFIRM PAYMENT")) return buttons[i];
    }
    return null;
  }

  function showPendingMessage(container) {
    var box = document.createElement("div");
    box.style.cssText =
      "margin-top:16px;padding:16px;border-radius:8px;background:#eef4ff;border:1px solid #3b6fd6;color:#1d3a70;font-weight:600;text-align:center;";
    box.innerText =
      "Order submitted! Your order is pending and will complete within 10 minutes. If not, contact admin.";
    container.appendChild(box);
  }

  async function submitOrder() {
    var phoneInput = getInputByPlaceholder("0771234567");
    var emailInput = getInputByPlaceholder("you@example.com");
    var approvalInput = getInputByPlaceholder("EcoCash approval code");

    var phone = phoneInput ? phoneInput.value.trim() : "";
    var email = emailInput ? emailInput.value.trim() : "";
    var approvalCode = approvalInput ? approvalInput.value.trim() : "";

    var platform = getValueNearLabel("PLATFORM");
    var service = getValueNearLabel("SERVICE");
    var quantityText = getValueNearLabel("QUANTITY");
    var link = getValueNearLabel("LINK");
    var totalText = getValueNearLabel("TOTAL PAYABLE");

    var quantity = parseInt((quantityText || "0").replace(/[^0-9]/g, ""), 10) || 0;
    var total = parseFloat((totalText || "0").replace(/[^0-9.]/g, "")) || 0;

    if (!email || !phone) {
      alert("Please fill in your WhatsApp number and email before confirming.");
      return false;
    }

    try {
      var res = await fetch(SUPABASE_URL + "/rest/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          email: email,
          phone: phone,
          platform: platform || "Unknown",
          service_name: service || "Unknown",
          quantity: quantity,
          link: link || "",
          total_amount: total,
          paynow_reference: approvalCode || null,
          status: "pending",
          ecocash_sender_name: "Manual EcoCash",
          browser_id: getBrowserId(),
        }),
      });

      if (!res.ok) {
        var errText = await res.text();
        console.error("Order insert failed:", errText);
        alert("Something went wrong submitting your order. Please try again or contact admin.");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Order insert error:", err);
      alert("Network error submitting your order. Please check your connection and try again.");
      return false;
    }
  }

  document.addEventListener(
    "click",
    function (e) {
      var btn = e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      var t = (btn.textContent || "").toUpperCase();
      if (t.includes("CONFIRM ORDER") || t.includes("CONFIRM PAYMENT")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        submitOrder().then(function (success) {
          if (success) {
            btn.disabled = true;
            btn.textContent = "Order Pending...";
            showPendingMessage(btn.parentElement || document.body);
          }
        });
      }
    },
    true
  );
})();
