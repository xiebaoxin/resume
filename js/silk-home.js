(function () {
  'use strict';

  var LANG_KEY = 'resume-lang';
  var DATA_VERSION = '20260316-21';
  var DEFAULT_LANG = 'zh';

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function isMobileViewport() {
    return window.innerWidth < 700;
  }

  function getLang() {
    var hash = (window.location.hash || '').toLowerCase();
    if (hash === '#en' || hash === '#english') return 'en';
    if (hash === '#zh' || hash === '#cn') return 'zh';
    try {
      return localStorage.getItem(LANG_KEY) || DEFAULT_LANG;
    } catch (_) {
      return DEFAULT_LANG;
    }
  }

  function setLang(lang) {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    if (lang === 'en') {
      window.location.hash = 'en';
    } else {
      window.location.hash = '';
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || '';
  }

  function setHTML(id, value) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = value || '';
  }

  function renderContactLine(data, lang, mobile) {
    var basics = data.basics || {};
    var contact = basics.contact || {};
    var education = data.education || {};
    var skills = data.skills || {};
    var tech = Array.isArray(skills.tech) ? skills.tech.slice(0, mobile ? 3 : 5) : [];
    var lines = [];

    function pushLine(items) {
      if (items.length) lines.push(items.join('  ·  '));
    }

    if (lang === 'en') {
      var line1 = [];
      if (contact.phone) line1.push('Tel: ' + contact.phone);
      if (contact.email) line1.push('Email: ' + contact.email);
      if (basics.location) line1.push('Location: ' + basics.location);
      pushLine(line1);

      var line2 = [];
      if (basics.yearsExp) line2.push('Experience: ' + basics.yearsExp);
      if (contact.wechat) line2.push('WeChat: ' + contact.wechat);
      if (contact.resumeRepo) line2.push('Resume: ' + contact.resumeRepo);
      pushLine(line2);

      if (!mobile) {
        var line3 = [];
        var edu = [education.degree, education.school].filter(Boolean).join(' · ');
        if (edu) line3.push('Education: ' + edu);
        if (tech.length) line3.push('Stack: ' + tech.join(' / '));
        pushLine(line3);
      }
    } else {
      var zhLine1 = [];
      if (contact.phone) zhLine1.push('电话：' + contact.phone);
      if (contact.email) zhLine1.push('邮箱：' + contact.email);
      if (basics.location) zhLine1.push('城市：' + basics.location);
      pushLine(zhLine1);

      var zhLine2 = [];
      if (basics.yearsExp) zhLine2.push('经验：' + basics.yearsExp);
      if (contact.wechat) zhLine2.push('微信：' + contact.wechat);
      if (contact.resumeRepo) zhLine2.push('简历：' + contact.resumeRepo);
      pushLine(zhLine2);

      if (!mobile) {
        var zhLine3 = [];
        var zhEdu = [education.school, education.degree].filter(Boolean).join(' · ');
        if (zhEdu) zhLine3.push('学历：' + zhEdu);
        if (tech.length) zhLine3.push('技术栈：' + tech.join(' / '));
        pushLine(zhLine3);
      }
    }

    return lines.map(function (line) {
      return '<p class="letter-contact">' + escapeHtml(line) + '</p>';
    }).join('');
  }

  function buildNarrative(lang, mobile) {
    if (lang === 'en') {
      return {
        targetRole: '',
        tagline: '',
        title: 'Awaiting the Right Horizon',
        p1: mobile
          ? 'I, Xie Baoxin, seek a stage worthy of full commitment and real outcomes. With AI-assisted engineering leadership and full-stack execution, I turn complex goals into clear milestones and deliver practical results with speed and discipline.'
          : 'I, Xie Baoxin, seek a stage worthy of full commitment and real outcomes. With AI-assisted engineering leadership and full-stack execution, I turn complex goals into clear milestones, align teams around delivery, and produce measurable business value.',
        p2: mobile
          ? 'Like a steed awaiting a true rider, I value the right mission and long-term direction. My strength is combining AI productivity with end-to-end delivery across Flutter, backend, and IoT / e-commerce / IM scenarios, so technical effort reliably becomes business value.'
          : 'Like a steed awaiting a true rider, I value the right mission and long-term direction. My strength is combining AI productivity with end-to-end delivery across Flutter, backend, and IoT / e-commerce / IM scenarios, while shaping engineering standards and team workflows that keep technical decisions aligned with business value.',
      };
    }
    return {
      targetRole: '',
      tagline: '',
      title: '待时乘风',
      p1: mobile
        ? '我，谢宝新，愿求一方可尽展所长的天地。若千里马待伯乐，我愿执 AI 辅助研发管理与全栈交付之缰，将繁难目标化为清晰里程碑，以确定性交付回应期许。'
        : '我，谢宝新，愿求一方可尽展所长的天地。若千里马待伯乐，我愿执 AI 辅助研发管理与全栈交付之缰，将繁难目标化为清晰里程碑，统筹协同、压实节奏，以确定性交付回应期许。',
      p2: mobile
        ? '亦如姜子牙待明主，所重者在同道同频。我的长处在“AI 提效 + 端到端落地”并进：自 Flutter 客户端至后端系统，再到 IoT / 电商 / IM 场景，皆可独立贯通，并使技术投入持续沉淀为业务增量。'
        : '亦如姜子牙待明主，所重者在同道同频。我的长处在“AI 提效 + 端到端落地”并进：自 Flutter 客户端至后端系统，再到 IoT / 电商 / IM 场景，皆可独立贯通；并以工程规范、协作机制与技术决策体系，令技术投入持续沉淀为业务增量。',
    };
  }

  function hash32(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return h >>> 0;
  }

  function seeded01(key, salt) {
    return (hash32(String(key || '') + '|' + String(salt || '')) % 1000) / 1000;
  }

  function normalizeTechKey(name) {
    var key = String(name || '').toLowerCase().replace(/[\s._-]+/g, '');
    if (key === 'javascriot') key = 'javascript';
    if (key === 'claudecode') key = 'claudecode';
    if (key === 'web-rtc') key = 'webrtc';
    return key;
  }

  function canonicalTechLabel(name) {
    var key = normalizeTechKey(name);
    var map = {
      cursor: 'Cursor',
      claudecode: 'Claude Code',
      flutter: 'Flutter',
      php: 'PHP',
      javascript: 'JavaScript',
      ffmpeg: 'ffmpeg',
      webrtc: 'WebRTC',
      rust: 'Rust',
      electron: 'Electron',
      canvas: 'Canvas',
      ethereum: 'Ethereum',
      solana: 'Solana',
      nosql: 'NoSql',
      java: 'Java',
      python: 'Python',
      mysql: 'MySQL',
      webaudio: 'WebAudio',
      openjdk: 'OpenJDK'
    };
    return map[key] || String(name || '');
  }

  function resolveTechLogoUrl(name) {
    var key = normalizeTechKey(name);
    var map = {
      cursor: 'assets/tech-logos/cursor.svg',
      claudecode: 'assets/tech-logos/claude.svg',
      flutter: 'assets/tech-logos/flutter.svg',
      php: 'assets/tech-logos/php.svg',
      javascript: 'assets/tech-logos/javascript.svg',
      ffmpeg: 'assets/tech-logos/ffmpeg.svg',
      webrtc: 'assets/tech-logos/webrtc.svg',
      rust: 'assets/tech-logos/rust.svg',
      electron: 'assets/tech-logos/electron.svg',
      canvas: 'assets/tech-logos/html5.svg',
      ethereum: 'assets/tech-logos/ethereum.svg',
      solana: 'assets/tech-logos/solana.svg',
      nosql: 'assets/tech-logos/mongodb.svg',
      java: 'assets/tech-logos/java.svg',
      python: 'assets/tech-logos/python.svg',
      mysql: 'assets/tech-logos/mysql.svg',
      webaudio: 'assets/tech-logos/html5.svg'
    };
    return map[key] || '';
  }

  function renderSilkTechCloud(data, lang, mobile) {
    var skills = data.skills || {};
    var fromData = Array.isArray(skills.tech) ? skills.tech.slice() : [];
    var merged = ['Cursor', 'Claude Code'].concat(fromData);
    var seen = Object.create(null);
    var items = [];
    for (var i = 0; i < merged.length; i++) {
      var label = canonicalTechLabel(merged[i]);
      var key = normalizeTechKey(label);
      if (!key || seen[key]) continue;
      seen[key] = true;
      items.push({ key: key, label: label });
    }

    var primaryKeys = ['cursor', 'flutter', 'php', 'javascript', 'ffmpeg', 'webrtc'];
    var primaryIndex = Object.create(null);
    for (var p = 0; p < primaryKeys.length; p++) primaryIndex[primaryKeys[p]] = p;

    items.sort(function (a, b) {
      var ar = Object.prototype.hasOwnProperty.call(primaryIndex, a.key) ? primaryIndex[a.key] : 999;
      var br = Object.prototype.hasOwnProperty.call(primaryIndex, b.key) ? primaryIndex[b.key] : 999;
      if (ar !== br) return ar - br;
      return a.label.localeCompare(b.label);
    });

    var html = [];
    for (var n = 0; n < items.length; n++) {
      var item = items[n];
      var rank = Object.prototype.hasOwnProperty.call(primaryIndex, item.key) ? primaryIndex[item.key] : -1;
      var rBase = seeded01(item.key, 'r');
      var x;
      var y;
      var rot;
      var cls;
      if (rank >= 0) {
        x = (primaryKeys.length <= 1 ? 50 : 10 + rank * (80 / (primaryKeys.length - 1))) + (rBase - 0.5) * 4;
        y = (mobile ? 1.0 : 1.3) + seeded01(item.key, 'y') * (mobile ? 0.9 : 1.05);
        rot = (seeded01(item.key, 'rot') - 0.5) * 10;
        cls = 'is-primary p' + (rank + 1);
      } else {
        x = 6 + seeded01(item.key, 'x') * 88;
        y = (mobile ? 2.25 : 2.7) + seeded01(item.key, 'y2') * (mobile ? 3.8 : 5.2);
        rot = (seeded01(item.key, 'rot2') - 0.5) * 24;
        var sec = 1 + Math.floor(seeded01(item.key, 'w') * 3);
        cls = 'is-secondary s' + sec;
      }
      var logo = resolveTechLogoUrl(item.key);
      html.push(
        '<span class="silk-tech-item ' + cls + '" style="--x:' + x.toFixed(2) + '%;--y:' + y.toFixed(2) + 'rem;--r:' + rot.toFixed(2) + 'deg;">' +
          (logo
            ? '<span class="tech-logo-wrap"><img class="tech-logo" src="' + escapeHtml(logo) + '" alt="" loading="eager" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" /></span>'
            : '<span class="tech-logo-wrap"><span class="tech-logo-fallback">◆</span></span>') +
          '<span class="tech-name">' + escapeHtml(item.label) + '</span>' +
        '</span>'
      );
    }
    if (!html.length) return '';
    var title = lang === 'en' ? 'Embroidered tech cloud' : '刺绣技术云';
    return '<div class="silk-tech-cloud" aria-label="' + escapeHtml(title) + '">' + html.join('') + '</div>';
  }

  function applyData(data) {
    var d = document;
    var lang = (data.meta && data.meta.lang) === 'en' ? 'en' : 'zh';
    var mobile = isMobileViewport();
    var narrative = buildNarrative(lang, mobile);

    setText('name', '');
    setText('basicsLine', '');
    setText('targetRole', narrative.targetRole);
    setText('tagline', narrative.tagline);
    setHTML('contact', '');

    setText('highlightTitle', narrative.title);
    setText('highlightCompany', '');
    setText('highlightPeriod', '');
    setText('highlightRole', '');
    setHTML(
      'highlightProducts',
      '<p class="letter-paragraph">' + escapeHtml(narrative.p1) + '</p>' +
      (narrative.p2 ? '<p class="letter-paragraph">' + escapeHtml(narrative.p2) + '</p>' : '') +
      renderSilkTechCloud(data, lang, mobile)
    );
    setText('metricPlay', '');
    setText('metricAppstore', '');
    setText('aiNote', '');

    var highlightHead = d.querySelector('.highlight-head');
    if (highlightHead) highlightHead.style.display = 'none';
    var metrics = d.querySelector('.metrics');
    if (metrics) metrics.style.display = 'none';

    ['experience', 'skills', 'education'].forEach(function (id) {
      var sec = d.getElementById(id);
      if (sec) sec.style.display = 'none';
    });

    d.body.classList.add('silk-letter-mode');
    d.getElementById('langSwitch').textContent = lang === 'en' ? '中文' : 'English';
    var modeSwitch = d.querySelector('.mode-switch');
    if (modeSwitch) {
      modeSwitch.textContent = lang === 'en' ? 'Classic' : '普通版';
    }
    if (data.meta && data.meta.title) {
      d.title = data.meta.title + (lang === 'en' ? ' (Silk)' : '（丝绸版）');
    }
    if (data.meta && data.meta.lang) {
      d.documentElement.lang = data.meta.lang === 'en' ? 'en' : 'zh-CN';
    }
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('silk-content-ready'));
    }, 30);
  }

  function loadLang(lang, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'data/' + (lang === 'en' ? 'en' : 'zh') + '.json?v=' + encodeURIComponent(DATA_VERSION), true);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status));
      }
    };
    xhr.onerror = function () {
      callback(new Error('Network error'));
    };
    xhr.send();
  }

  function init() {
    var lang = getLang();
    document.body.classList.add('silk-letter-mode');
    var switchBtn = document.getElementById('langSwitch');
    switchBtn.addEventListener('click', function () {
      var next = lang === 'zh' ? 'en' : 'zh';
      setLang(next);
      loadLang(next, function (err, data) {
        if (!err) {
          lang = next;
          applyData(data);
        }
      });
    });

    loadLang(lang, function (err, data) {
      if (err) {
        if (lang !== 'zh') {
          loadLang('zh', function (e2, d2) {
            if (!e2) applyData(d2);
          });
        }
        return;
      }
      applyData(data);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
