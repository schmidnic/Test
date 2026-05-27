var ScormAPI = {
  api: null,
  initialized: false,

  findAPI: function(win) {
    var tries = 0;
    while (win.API == null && win.parent != null && win.parent !== win) {
      tries++;
      if (tries > 7) break;
      win = win.parent;
    }
    return win.API || null;
  },

  init: function() {
    this.api = this.findAPI(window);
    if (this.api) {
      this.api.LMSInitialize("");
      this.initialized = true;
    }
  },

  setValue: function(key, value) {
    if (this.api && this.initialized) {
      this.api.LMSSetValue(key, String(value));
      this.api.LMSCommit("");
    }
  },

  getValue: function(key) {
    if (this.api && this.initialized) {
      return this.api.LMSGetValue(key);
    }
    return "";
  },

  saveLocation: function(lesson) {
    this.setValue("cmi.core.lesson_location", lesson);
  },

  getLocation: function() {
    var loc = parseInt(this.getValue("cmi.core.lesson_location"));
    return isNaN(loc) ? 0 : loc;
  },

  complete: function() {
    this.setValue("cmi.core.lesson_status", "completed");
    this.setValue("cmi.core.score.raw", "100");
    this.setValue("cmi.core.score.min", "0");
    this.setValue("cmi.core.score.max", "100");
  },

  finish: function() {
    if (this.api && this.initialized) {
      this.api.LMSFinish("");
      this.initialized = false;
    }
  }
};

window.addEventListener("beforeunload", function() {
  ScormAPI.finish();
});
