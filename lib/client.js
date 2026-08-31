// =============================================================================
// Kun Like 桌宠 · DSH 静态插件（Client 端 bundle）
// 浏览器端通过 /plugins/dsh-kun-pet/client.js 加载
// 与 Host 端通过 HTTP JSON 接口（/kun-pet/state）通信
// =============================================================================

window.__ModuleLoader__.load({
  id: "dsh-kun-pet",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var React = require("react");

    // ===== 常量 =====
    var CW = 192, CH = 208, SCALE = 0.85, W = CW * SCALE, H = CH * SCALE;

    // 8 列 × 9 行精灵图
    var ROWS = {
      idle: { row: 0, count: 6, frames: [280, 110, 110, 140, 140, 320] },
      runRight: { row: 1, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      runLeft: { row: 2, count: 8, frames: [120, 120, 120, 120, 120, 120, 120, 220] },
      wave: { row: 3, count: 4, frames: [140, 140, 140, 280] },
      jump: { row: 4, count: 5, frames: [140, 140, 140, 140, 280] },
      failed: { row: 5, count: 8, frames: [140, 140, 140, 140, 140, 140, 140, 240] },
      waiting: { row: 6, count: 6, frames: [150, 150, 150, 150, 150, 260] },
      working: { row: 7, count: 6, frames: [120, 120, 120, 120, 120, 220] },
      review: { row: 8, count: 6, frames: [150, 150, 150, 150, 150, 280] },
    };

    var MODE_ANIM = { idle: "idle", working: "working", review: "review", waiting: "waiting", failed: "failed", celebrating: "wave" };
    var BUBBLES = {
      idle: "休息中~ 有事叫我",
      working: "努力工作中…",
      review: "思考中…",
      waiting: "在等你回复哦~",
      failed: "呜…出错了 (._.)",
      celebrating: "完成啦！你干嘛~哎哟",
      dragging: "呜哇~ 别拽我！",
      poke: "诶嘿~",
    };

    // ===== 音频 =====
    var globalAudio = null;
    var voiceReady = false;

    var initAudio = function(url) {
      if (!url) return;
      if (!globalAudio) { globalAudio = new Audio(); globalAudio.preload = "auto"; }
      if (globalAudio.src !== url) { globalAudio.src = url; globalAudio.load(); }
      voiceReady = true;
    };
    var playVoice = function() {
      if (!globalAudio || !voiceReady) return;
      try {
        globalAudio.currentTime = 0;
        var p = globalAudio.play();
        if (p && typeof p.catch === "function") p.catch(function() {});
      } catch (e) {}
    };

    // ===== KunPet 组件 =====
    function KunPet() {
      var stState = React.useState({ mode: "idle", seq: -1, spriteUrl: null, voiceUrl: null });
      var st = stState[0], setSt = stState[1];
      var frameState = React.useState(0);
      var frame = frameState[0], setFrame = frameState[1];
      var posState = React.useState(null);
      var pos = posState[0], setPos = posState[1];
      var draggingState = React.useState(false);
      var dragging = draggingState[0], setDragging = draggingState[1];
      var dragDirState = React.useState("runRight");
      var dragDir = dragDirState[0], setDragDir = dragDirState[1];
      var reactionState = React.useState(null);
      var reaction = reactionState[0], setReaction = reactionState[1];
      var celebrateAnimState = React.useState("wave");
      var celebrateAnim = celebrateAnimState[0], setCelebrateAnim = celebrateAnimState[1];

      var lastCelebrateSeq = React.useRef(-1);
      var celebrateFlip = React.useRef(0);
      var dragData = React.useRef(null);
      var reactionTimer = React.useRef(null);
      var viewportEl = React.useRef(null);

      // 同步状态（HTTP 轮询）
      React.useEffect(function() {
        var alive = true;
        var sync = function() {
          fetch("/kun-pet/state", { cache: "no-store" })
            .then(function(r) { return r.json(); })
            .then(function(s) {
              if (!alive || !s) return;
              setSt(function(prev) {
                var sq = typeof s.seq === "number" ? s.seq : 0;
                if (prev.seq === sq && prev.spriteUrl === s.spriteUrl && prev.voiceUrl === s.voiceUrl) return prev;
                if (s.voiceUrl) initAudio(s.voiceUrl);
                return { mode: String(s.mode || "idle"), seq: sq, spriteUrl: s.spriteUrl || null, voiceUrl: s.voiceUrl || null };
              });
            })
            .catch(function() {});
        };
        sync();
        var timer = window.setInterval(sync, 400);
        return function() { alive = false; window.clearInterval(timer); };
      }, []);

      // 庆祝动画（声音由 Host 端 PowerShell 统一播放一次，避免双端重复）
      React.useEffect(function() {
        if (st.mode !== "celebrating" || st.seq === lastCelebrateSeq.current) return;
        lastCelebrateSeq.current = st.seq;
        celebrateFlip.current = celebrateFlip.current + 1;
        setCelebrateAnim(celebrateFlip.current % 2 === 0 ? "jump" : "wave");
      }, [st.mode, st.seq]);

      React.useEffect(function() {
        return function() {
          if (reactionTimer.current) { window.clearTimeout(reactionTimer.current); reactionTimer.current = null; }
        };
      }, []);

      // 动画状态
      var anim, bubble;
      if (dragging) { anim = dragDir; bubble = BUBBLES.dragging; }
      else if (reaction) { anim = reaction; bubble = BUBBLES.poke; }
      else if (st.mode === "celebrating") { anim = celebrateAnim; bubble = BUBBLES.celebrating; }
      else { anim = MODE_ANIM[st.mode] || "idle"; bubble = BUBBLES[st.mode] || BUBBLES.idle; }
      var spec = ROWS[anim] || ROWS.idle;

      // 帧动画
      React.useEffect(function() {
        setFrame(0);
        var disposed = false;
        var stopTimer = null;
        var step = function(i) {
          if (disposed) return;
          setFrame(i);
          var delay = spec.frames[i] || 150;
          stopTimer = window.setTimeout(function() { step((i + 1) % spec.count); }, delay);
        };
        step(0);
        return function() { disposed = true; if (stopTimer) window.clearTimeout(stopTimer); };
      }, [anim]);

      // 点击反应
      var doReaction = function(animName, ms) {
        setReaction(animName);
        if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
        reactionTimer.current = window.setTimeout(function() {
          reactionTimer.current = null;
          setReaction(null);
        }, ms);
      };

      // 拖拽事件
      var onPointerDown = function(e) {
        if (typeof e.button === "number" && e.button !== 0) return;
        var el = e.currentTarget;
        try { el.setPointerCapture(e.pointerId); } catch (err) {}
        var rect = el.getBoundingClientRect();
        dragData.current = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, moved: false };
        setDragging(true);
      };
      var onPointerMove = function(e) {
        var d = dragData.current;
        if (!d) return;
        var dx = e.clientX - d.x;
        var dy = e.clientY - d.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
        if (dx > 4) setDragDir("runRight");
        else if (dx < -4) setDragDir("runLeft");
        var vp = viewportSize(viewportEl);
        var left = Math.min(Math.max(d.left + dx, -W * 0.7), vp.w - W * 0.3);
        var top = Math.min(Math.max(d.top + dy, -H * 0.5), vp.h - H * 0.5);
        setPos({ left: left, top: top });
      };
      var onPointerEnd = function() {
        var d = dragData.current;
        dragData.current = null;
        setDragging(false);
        if (d && !d.moved) { doReaction("wave", 2400); playVoice(); }
      };

      // 渲染
      var col = frame % spec.count;
      var bgX = -(col * W);
      var bgY = -(spec.row * H);

      var wrapStyle = {
        position: "fixed", width: W, height: H, zIndex: 1000,
        pointerEvents: "auto", userSelect: "none", WebkitUserSelect: "none", touchAction: "none",
      };
      if (pos) { wrapStyle.left = pos.left; wrapStyle.top = pos.top; }
      else { wrapStyle.right = 20; wrapStyle.bottom = 20; }

      var spriteStyle = {
        position: "absolute", left: 0, top: 0, width: W, height: H,
        backgroundImage: st.spriteUrl ? 'url("' + st.spriteUrl + '")' : "none",
        backgroundSize: String(W * 8) + "px " + String(H * 9) + "px",
        backgroundPosition: String(bgX) + "px " + String(bgY) + "px",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        cursor: dragging ? "grabbing" : "grab",
      };

      var bubbleStyle = {
        position: "absolute", left: "50%", bottom: "100%", marginBottom: 12,
        transform: "translateX(-50%)", background: "rgba(255,255,255,0.96)", color: "#333",
        border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "6px 12px",
        fontSize: 13, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.14)", pointerEvents: "none", zIndex: 2,
      };

      var children = [
        st.spriteUrl
          ? React.createElement("div", { key: "sprite", style: spriteStyle })
          : React.createElement("div", {
              key: "emoji",
              style: { position: "absolute", left: 0, top: 0, width: W, height: H, fontSize: 110, lineHeight: 1.6, textAlign: "center" },
            }, "\uD83D\uDC24"),
        React.createElement("div", { key: "bubble", style: bubbleStyle }, bubble),
        React.createElement("div", {
          key: "viewport",
          ref: function(el) { viewportEl.current = el; },
          style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", visibility: "hidden" },
        }),
      ];

      return React.createElement("div", {
        onPointerDown: onPointerDown,
        onPointerMove: onPointerMove,
        onPointerUp: onPointerEnd,
        onPointerCancel: onPointerEnd,
        style: wrapStyle,
        title: "Kun Like 桌宠 \u00b7 拖动移动 \u00b7 点击互动",
      }, children);
    }

    var viewportSize = function(viewportRef) {
      if (viewportRef && viewportRef.current) {
        var r = viewportRef.current.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
      }
      return { w: window.innerWidth || 1400, h: window.innerHeight || 900 };
    };

    // ===== 插件导出 =====
    exports.inject = ["slots"];

    exports.apply = function(ctx) {
      var slots = ctx.get("slots");
      if (slots === undefined) return;
      slots.inject("shell.overlay", function() {
        return slots.register(
          { name: "shell.overlay", id: "kun-pet", order: 100, label: "Kun Like 桌宠" },
          function() { return React.createElement(KunPet); }
        );
      });
    };

    return module.exports;
  },
});
