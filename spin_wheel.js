(function () {
  var SUPABASE_URL = "https://ybncizxgvtfkngvjchgp.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_aonyZhP_jpv2CKRWAeEl9g_bmS_7igl";

  var SPIN_COUNT_KEY = "zimboost_spin_count";
  var LAST_SPIN_KEY = "zimboost_last_spin_time";
  var PENDING_CLAIM_KEY = "zimboost_pending_claim";
  var CLAIM_DRAFT_KEY = "zimboost_claim_ecocash_draft";
  var COOLDOWN_MS = 24 * 60 * 60 * 1000;

  var SEGMENTS = [
    { label: "$5", color: "#2e7d32", type: "decorative" },
    { label: "Try Again", color: "#c62828", type: "lose" },
    { label: "TikTok\nFree", color: "#1a237e", type: "decorative" },
    { label: "Try Again", color: "#ef6c00", type: "lose" },
    { label: "$1", color: "#f9a825", type: "win1" },
    { label: "IG\nFree", color: "#ad1457", type: "decorative" },
    { label: "Try Again", color: "#1565c0", type: "lose" },
    { label: "Try Again", color: "#4e342e", type: "lose" },
  ];
  var SLICE_ANGLE = 360 / SEGMENTS.length;

  function getBrowserId() {
    var key = "zimboost_browser_id";
    var id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getSpinCount() {
    return parseInt(localStorage.getItem(SPIN_COUNT_KEY) || "0", 10);
  }
  function bumpSpinCount() {
    localStorage.setItem(SPIN_COUNT_KEY, String(getSpinCount() + 1));
  }
  function getLastSpinTime() {
    var v = localStorage.getItem(LAST_SPIN_KEY);
    return v ? parseInt(v, 10) : 0;
  }
  function setLastSpinTime() {
    localStorage.setItem(LAST_SPIN_KEY, String(Date.now()));
  }
  function msUntilNextSpin() {
    var elapsed = Date.now() - getLastSpinTime();
    return Math.max(0, COOLDOWN_MS - elapsed);
  }
  function formatCountdown(ms) {
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    return [h, m, s].map(function (n) { return String(n).padStart(2, "0"); }).join(":");
  }

  function getPendingClaim() {
    var raw = localStorage.getItem(PENDING_CLAIM_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  function setPendingClaim(obj) {
    localStorage.setItem(PENDING_CLAIM_KEY, JSON.stringify(obj));
  }
  function clearPendingClaim() {
    localStorage.removeItem(PENDING_CLAIM_KEY);
    localStorage.removeItem(CLAIM_DRAFT_KEY);
  }

  function isValidEcocashNumber(v) {
    return /^07\d{8}$/.test(v.trim());
  }

  function getOutcomeType() {
    var n = getSpinCount() % 6;
    if (n === 2) return "win1";
    return "lose";
  }

  async function getApprovedOrderCount() {
    try {
      var url =
        SUPABASE_URL +
        "/rest/v1/orders?browser_id=eq." +
        getBrowserId() +
        "&status=eq.active&select=id";
      var res = await fetch(url, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      });
      if (!res.ok) return 0;
      var data = await res.json();
      return Array.isArray(data) ? data.length : 0;
    } catch (e) {
      console.error("Eligibility check failed:", e);
      return 0;
    }
  }

  function pickTargetSegmentIndex(outcomeType) {
    var candidates = [];
    for (var i = 0; i < SEGMENTS.length; i++) {
      if (SEGMENTS[i].type === outcomeType) candidates.push(i);
    }
    if (candidates.length === 0) candidates = [0];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function drawWheel(canvas) {
    var ctx = canvas.getContext("2d");
    var size = canvas.width;
    var radius = size / 2;
    ctx.clearRect(0, 0, size, size);
    for (var i = 0; i < SEGMENTS.length; i++) {
      var startAngle = (i * SLICE_ANGLE - 90) * (Math.PI / 180);
      var endAngle = ((i + 1) * SLICE_ANGLE - 90) * (Math.PI / 180);
      ctx.beginPath();
      ctx.moveTo(radius, radius);
      ctx.arc(radius, radius, radius - 4, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENTS[i].color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(radius, radius);
      ctx.rotate(((i + 0.5) * SLICE_ANGLE - 90) * (Math.PI / 180));
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px sans-serif";
      var lines = SEGMENTS[i].label.split("\n");
      lines.forEach(function (line, idx) {
        ctx.fillText(line, radius - 16, idx * 14 - (lines.length - 1) * 7);
      });
      ctx.restore();
    }
  }

  async function notifyWheelWin(ecocashNumber) {
    try {
      await fetch(SUPABASE_URL + "/functions/v1/notify-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record: {
            id: "WHEEL-" + Date.now(),
            platform: "SPIN WHEEL",
            service_name: "$1 Prize Won",
            quantity: 1,
            link: "N/A",
            total_amount: 1,
            email: "N/A",
            phone: ecocashNumber,
            paynow_reference: "browser_id: " + getBrowserId(),
          },
        }),
      });
    } catch (e) {
      console.error("Wheel win notification failed:", e);
    }
  }

  function renderClaimForm(container, claim) {
    container.innerHTML = "";
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:20px;max-width:320px;margin:0 auto;";

    var title = document.createElement("div");
    title.style.cssText = "font-size:20px;font-weight:800;color:#222;text-align:center;";
    title.innerText = "You won " + claim.prize + "!";
    wrapper.appendChild(title);

    var sub = document.createElement("div");
    sub.style.cssText = "margin-top:8px;font-size:13px;color:#555;text-align:center;";
    sub.innerText = "Enter the EcoCash number to receive your prize on.";
    wrapper.appendChild(sub);

    var label = document.createElement("label");
    label.style.cssText = "margin-top:16px;font-size:12px;font-weight:700;color:#333;align-self:flex-start;";
    label.innerText = "ECOCASH NUMBER";
    wrapper.appendChild(label);

    var input = document.createElement("input");
    input.type = "tel";
    input.placeholder = "e.g. 0771234567";
    input.value = localStorage.getItem(CLAIM_DRAFT_KEY) || "";
    input.style.cssText = "margin-top:6px;width:100%;padding:12px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box;";
    wrapper.appendChild(input);

    input.addEventListener("input", function () {
      localStorage.setItem(CLAIM_DRAFT_KEY, input.value);
    });

    var errorText = document.createElement("div");
    errorText.style.cssText = "margin-top:8px;font-size:12px;color:#c62828;min-height:16px;text-align:center;";
    wrapper.appendChild(errorText);

    var submitBtn = document.createElement("button");
    submitBtn.style.cssText = "margin-top:12px;padding:12px 28px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;width:100%;";
    submitBtn.innerText = "SUBMIT";
    wrapper.appendChild(submitBtn);

    container.appendChild(wrapper);

    submitBtn.addEventListener("click", async function () {
      var val = input.value.trim();
      if (!isValidEcocashNumber(val)) {
        errorText.innerText = "Enter a valid EcoCash number (starts with 07, 10 digits total).";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting...";
      await notifyWheelWin(val);
      clearPendingClaim();
      setLastSpinTime();

      var wins = JSON.parse(localStorage.getItem("zimboost_wheel_wins") || "[]");
      wins.push({ prize: claim.prize, date: new Date().toISOString(), ecocash: val });
      localStorage.setItem("zimboost_wheel_wins", JSON.stringify(wins));

      wrapper.innerHTML =
        '<div style="font-size:18px;font-weight:800;color:#2e7d32;text-align:center;">Submitted!</div>' +
        '<div style="margin-top:8px;font-size:13px;color:#555;text-align:center;">We have received your claim. Your ' +
        claim.prize +
        " will be sent to " +
        val +
        ". Come back in 24 hours for your next spin.</div>";
    });
  }

  function buildWheelUI(container) {
    var pendingClaim = getPendingClaim();
    if (pendingClaim) {
      renderClaimForm(container, pendingClaim);
      return;
    }

    container.innerHTML = "";

    var wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:16px;";

    var pointer = document.createElement("div");
    pointer.style.cssText =
      "width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:22px solid #222;margin-bottom:-6px;z-index:2;";
    wrapper.appendChild(pointer);

    var canvasSize = 280;
    var canvas = document.createElement("canvas");
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.cssText =
      "border-radius:50%;border:6px solid #222;transition:transform 6s cubic-bezier(0.17,0.67,0.32,1.01);background:#fff;";
    drawWheel(canvas);
    wrapper.appendChild(canvas);

    var statusText = document.createElement("div");
    statusText.style.cssText = "margin-top:16px;font-weight:700;text-align:center;font-size:15px;color:#222;";
    wrapper.appendChild(statusText);

    var hint = document.createElement("div");
    hint.style.cssText = "margin-top:8px;font-size:12px;color:#555;text-align:center;";
    hint.innerText = "Tip: the higher your order value, the better your future prize chances!";
    wrapper.appendChild(hint);

    var spinBtn = document.createElement("button");
    spinBtn.style.cssText =
      "margin-top:16px;padding:12px 28px;background:#1565c0;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:15px;";
    spinBtn.innerText = "SPIN";
    wrapper.appendChild(spinBtn);

    container.appendChild(wrapper);

    var currentRotation = 0;
    var spinning = false;

    async function refreshState() {
      if (getPendingClaim()) {
        renderClaimForm(container, getPendingClaim());
        return;
      }

      var approvedCount = await getApprovedOrderCount();
      var cooldown = msUntilNextSpin();

      if (approvedCount < 2) {
        spinBtn.disabled = true;
        spinBtn.style.opacity = "0.5";
        statusText.innerText = "Complete 2 approved orders to unlock the wheel (" + approvedCount + "/2)";
        return;
      }

      if (cooldown > 0) {
        spinBtn.disabled = true;
        spinBtn.style.opacity = "0.5";
        statusText.innerText = "Next free spin in " + formatCountdown(cooldown);
        setTimeout(refreshState, 1000);
        return;
      }

      spinBtn.disabled = false;
      spinBtn.style.opacity = "1";
      statusText.innerText = "You're eligible! Tap SPIN to try your luck.";
    }

    spinBtn.addEventListener("click", function () {
      if (spinning) return;
      spinning = true;
      spinBtn.disabled = true;

      var outcomeType = getOutcomeType();
      var targetIndex = pickTargetSegmentIndex(outcomeType);
      var targetCenterAngle = targetIndex * SLICE_ANGLE + SLICE_ANGLE / 2;
      var fullSpins = 6;
      var finalRotation =
        currentRotation + fullSpins * 360 + (360 - targetCenterAngle) - (currentRotation % 360);

      canvas.style.transform = "rotate(" + finalRotation + "deg)";
      currentRotation = finalRotation;

      setTimeout(function () {
        spinning = false;
        bumpSpinCount();

        var prize = SEGMENTS[targetIndex].label.replace("\n", " ");
        if (outcomeType === "win1") {
          setPendingClaim({ prize: "$1", wonAt: new Date().toISOString() });
          renderClaimForm(container, getPendingClaim());
        } else {
          setLastSpinTime();
          statusText.innerText = "So close! You landed on: " + prize + ". Try again in 24 hours.";
          refreshState();
        }
      }, 6200);
    });

    refreshState();
  }

  function tryInit() {
    var all = document.querySelectorAll("body *");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.children.length === 0 && el.textContent.trim().toUpperCase().includes("DAILY SPIN CHALLENGE")) {
        var container = el.closest("div");
        var host = container ? container.parentElement : null;
        if (host) {
          var wheelHost = document.createElement("div");
          wheelHost.id = "zimboost-real-wheel";
          host.insertBefore(wheelHost, container);
          if (container.previousElementSibling) {
            container.previousElementSibling.style.display = "none";
          }
          buildWheelUI(wheelHost);
          return true;
        }
      }
    }
    return false;
  }

  var attempts = 0;
  var interval = setInterval(function () {
    attempts++;
    if (tryInit() || attempts > 20) clearInterval(interval);
  }, 500);
})();
