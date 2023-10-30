var background = (function () {
  let tmp = {};
  if (chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function (request) {
      for (let id in tmp) {
        if (tmp[id] && (typeof tmp[id] === "function")) {
          if (request.path === "background-to-popup") {
            if (request.method === id) tmp[id](request.data);
          }
        }
      }
    });
    /*  */
    return {
      "receive": function (id, callback) {
        tmp[id] = callback;
      },
      "send": function (id, data) {
        if (id) {
          chrome.runtime.sendMessage({
            "method": id,
            "data": data,
            "path": "popup-to-background"
          }, function () {
            return chrome.runtime.lastError;
          });
        }
      },
    }
  } else {
    return {
      "send": function () {},
      "receive": function () {}
    }
  }
})();

var config = {
  "addon": {
    "homepage": function () {
      return chrome.runtime.getManifest().homepage_url;
    }
  },
  "app": {
    "start": function () {
      config.radio.load.database(function () {
        config.radio.render.flash(false);
        config.radio.render.countries();
        config.radio.render.stations(true);
      });
    },
    "prefs": {
      set volume (val) {config.storage.write("volume", val)},
      set country (val) {config.storage.write("country", val)},
      set station (val) {config.storage.write("station", val)},
      get volume () {return config.storage.read("volume") !== undefined ? config.storage.read("volume") : 0.1},
      get station () {return config.storage.read("station") !== undefined ? config.storage.read("station") : 0},
      get country () {return config.storage.read("country") !== undefined ? config.storage.read("country") : ''}
    }
  },
  "resize": {
    "timeout": null,
    "method": function () {
      if (config.port.name === "win") {
        if (config.resize.timeout) window.clearTimeout(config.resize.timeout);
        config.resize.timeout = window.setTimeout(async function () {
          const current = await chrome.windows.getCurrent();
          /*  */
          config.storage.write("interface.size", {
            "top": current.top,
            "left": current.left,
            "width": current.width,
            "height": current.height
          });
        }, 1000);
      }
    }
  },
  "port": {
    "name": '',
    "connect": function () {
      config.port.name = "webapp";
      const context = document.documentElement.getAttribute("context");
      /*  */
      if (chrome.runtime) {
        if (chrome.runtime.connect) {
          if (context !== config.port.name) {
            if (document.location.search === "?tab") config.port.name = "tab";
            if (document.location.search === "?win") config.port.name = "win";
            /*  */
            chrome.runtime.connect({
              "name": config.port.name
            });
          }
        }
      }
      /*  */
      document.documentElement.setAttribute("context", config.port.name);
    }
  },
  "storage": {
    "local": {},
    "read": function (id) {
      return config.storage.local[id];
    },
    "load": function (callback) {
      chrome.storage.local.get(null, function (e) {
        config.storage.local = e;
        callback();
      });
    },
    "write": function (id, data) {
      if (id) {
        if (data !== '' && data !== null && data !== undefined) {
          let tmp = {};
          tmp[id] = data;
          config.storage.local[id] = data;
          chrome.storage.local.set(tmp, function () {});
        } else {
          delete config.storage.local[id];
          chrome.storage.local.remove(id, function () {});
        }
      }
    }
  },
  "load": function () {
    const player = document.getElementById("player");
    const stations = document.getElementById("stations");
    const countries = document.getElementById("countries");
    /*  */
    const reset = document.querySelector(".reset");
    const reload = document.querySelector(".reload");
    const support = document.querySelector(".support");
    const donation = document.querySelector(".donation");
    /*  */
    reload.addEventListener("click", function () {
      document.location.reload();
    });
    /*  */
    stations.addEventListener("change", function (e) {
      config.app.prefs.station = e.target.selectedIndex;
      config.radio.render.stations(false);
    });
    /*  */
    player.addEventListener("volumechange", function (e) {
      if (e.target.volume) {
        config.app.prefs.volume = e.target.volume;
      }
    });
    /*  */
    countries.addEventListener("change", function (e) {
      config.app.prefs.station = 0;
      config.app.prefs.country = e.target.value;
      config.radio.render.stations(true);
    });
    /*  */
    support.addEventListener("click", function () {
      if (config.port.name !== "webapp") {
        const url = config.addon.homepage();
        chrome.tabs.create({"url": url, "active": true});
      }
    }, false);
    /*  */
    donation.addEventListener("click", function () {
      if (config.port.name !== "webapp") {
        const url = config.addon.homepage() + "?reason=support";
        chrome.tabs.create({"url": url, "active": true});
      }
    }, false);
    /*  */
    reset.addEventListener("click", function () {
      const flag = window.confirm("Are you sure you want to reset the app to factory settings?");
      if (flag) {
        config.app.prefs.station = 0;
        config.app.prefs.country = '';
        config.storage.write("width", 900);
        config.storage.write("height", 700);
        /*  */
        document.querySelector(".reset").disabled = true;
        document.querySelector(".reload").disabled = true;
        window.setTimeout(function () {document.location.reload()}, 300);
      }
    });
    /*  */
    config.storage.load(config.app.start);
    window.removeEventListener("load", config.load, false);
  },
  "radio": {
    "countries": [],
    "load": {
      "database": function (callback) {
        config.radio.render.flash(true);
        config.radio.load.countries(callback);
      },
      "channel": function (country, callback) {
        const request = new XMLHttpRequest();
        request.open("GET", "stations/" + country + ".json");
        request.onload = function () {
          const channel = JSON.parse(request.responseText);
          if (channel) callback(channel);
        };
        /*  */
        request.send();
      },
      "countries": function (callback) {
        const request = new XMLHttpRequest();
        request.open("GET", "stations/countries.json");
        request.onload = function () {
          config.radio.countries = JSON.parse(request.responseText);
          callback(config.radio.countries.length);
        };
        /*  */
        request.send();
      },
      "player": function () {
        const target = document.querySelector(".channel-url");
        if (target) {
          if (target.textContent) {
            const player = document.getElementById("player");
            if (player) {
              player.disabled = true;
              target.style.color = "#999999";
              config.radio.render.flash(true);
              window.setTimeout(function () {player.src = target.textContent}, 1000);
              /*  */
              player.onplaying = function () {config.radio.render.flash(false)};
              player.onloadedmetadata = function () {
                player.volume = config.app.prefs.volume;
                config.radio.render.flash(false);
                target.style.color = "#05ab0b";
                player.disabled = false;
              };
              /*  */
              player.onerror = function () {
                config.radio.render.flash(false);
                target.style.color = "#e61b1b";
                player.disabled = true;
                player.volume = 0;
                /*  */
                const dummy = document.querySelector(".dummy");
                dummy.textContent = "An error has occurred! please try a different channel.";
              };
            }
          }
        }
      }
    },
    "render": {
      "timeout": null,
      "dummy": {
        "option": function (parent, txt) {
          var option = document.createElement("option");
          option.textContent = ' ' + txt;
          option.disabled = true;
          parent.appendChild(option);
          /*  */
          var option = document.createElement("option");
          option.textContent = '';
          option.disabled = true;
          parent.appendChild(option);
        }
      },
      "countries": function () {
        const countries = document.getElementById("countries");
        countries.textContent = '';
        /*  */
        config.radio.countries.sort();
        config.radio.render.dummy.option(countries, "Choose a desired country");
        for (let i = 0; i < config.radio.countries.length; i++) {
          const option = document.createElement("option");
          option.textContent = config.radio.countries[i];
          option.value = config.radio.countries[i];
          countries.appendChild(option);
        }
        /*  */
        if (config.app.prefs.country) {
          countries.value = config.app.prefs.country;
        } else {
          countries.selectedIndex = 0;
        }
      },
      "flash": function (flag) {
        const dummy = document.querySelector(".dummy");
        const border = document.querySelector(".image");
        if (config.radio.render.timeout) window.clearTimeout(config.radio.render.timeout);
        /*  */
        if (flag) {
          config.radio.render.timeout = window.setTimeout(function () {
            const color = border ? (border.style.borderColor.indexOf("0.1") !== -1 ? "0.2" : "0.1") : '0';
            const count = function () {return (dummy.textContent.match(/\./g) || []).length};
            const dots = count() === 0 ? "." : (count() === 1 ? ".." : (count() === 2 ? "..." : ''));
            if (border) border.style.borderColor = "rgba(0,0,0," + color + ")";
            dummy.textContent = "Loading, please wait" + dots;
            config.radio.render.flash(flag);
          }, 500);
        } else {
          dummy.textContent = '';
          if (border) border.style.borderColor = "rgba(0,0,0,0.1)";
        }
      },
      "stations": function (build) {
        const country = config.app.prefs.country;
        if (country) {
          config.radio.load.channel(country, function (channel) {
            const stations = document.getElementById("stations");
            const count = document.querySelector(".count .channel");
            /*  */
            if (build) {
              stations.textContent = '';
              config.radio.render.dummy.option(stations, "Choose a desired station");
              for (let id in channel) {
                const option = document.createElement("option");
                option.setAttribute("value", id);
                option.setAttribute("ip", channel[id].ip);
                option.setAttribute("url", channel[id].url);
                option.setAttribute("tags", channel[id].tags);
                option.setAttribute("name", channel[id].name);
                option.setAttribute("state", channel[id].state);
                option.setAttribute("votes", channel[id].votes);
                option.setAttribute("codec", channel[id].codec);
                option.setAttribute("bitrate", channel[id].bitrate);
                option.setAttribute("favicon", channel[id].favicon);
                option.setAttribute("country", channel[id].country);
                option.setAttribute("language", channel[id].language);
                option.setAttribute("homepage", channel[id].homepage);
                option.setAttribute("negativevotes", channel[id].negativevotes);
                /*  */
                option.textContent = channel[id].name;
                stations.appendChild(option);
              }
            }
            /*  */
            stations.selectedIndex = config.app.prefs.station;
            count.textContent = Object.keys(channel).length;
            config.radio.render.info();
            config.radio.load.player();
          });
        }
      },
      "info": function () {
        const info = document.querySelector(".info");
        const image = document.querySelector(".image");
        const stations = document.getElementById("stations");
        const img = image.querySelector("div").querySelector("img");
        const svg = image.querySelector("div").querySelector("svg");
        /*  */
        let sorted = [];
        let unsorted = [];
        info.textContent = '';
        /*  */
        const station = stations[stations.selectedIndex];
        if (station === undefined || station.disabled) return;
        /*  */
        const attributes = station.attributes;
        for (let index in attributes) {
          if (attributes[index]) {
            const name = attributes[index].name;
            if (name && name !== "value") {
              const value = station.getAttribute(name);
              if (value) {
                unsorted.push(name);
              }
            }
          }
        }
        /*  */
        sorted = unsorted.sort();
        for (let i = 0; i < sorted.length; i++) {
          const name = sorted[i];
          const value = station.getAttribute(name);
          if (name && value && name !== "value") {
            const tr = document.createElement("tr");
            /*  */
            var td = document.createElement("td");
            td.setAttribute("type", "name");
            td.textContent = name;
            const uppercase = name === "ip" || name === "url";
            if (uppercase) td.style.textTransform = "uppercase";
            tr.appendChild(td);
            /*  */
            var td = document.createElement("td");
            td.setAttribute("type", "value");
            td.setAttribute("class", "channel-" + name);
            td.textContent =  station.getAttribute(name);
            tr.appendChild(td);
            /*  */
            info.appendChild(tr);
          }
        }
        /*  */
        img.style.display = "none";
        svg.style.display = "block";
        img.src = station.getAttribute("favicon");
        /*  */
        img.onload = function () {
          svg.style.display = "none";
          img.style.display = "block";
        };
        /*  */
        img.onerror = function () {
          img.style.display = "none";
          svg.style.display = "block";
        };
      }
    }
  }
};

config.port.connect();

window.addEventListener("load", config.load, false);
window.addEventListener("resize", config.resize.method, false);
