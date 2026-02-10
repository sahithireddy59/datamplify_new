(function (global) {
  const SDK = {};
  let config = {};
  let iframeEl = null;
  let accessToken = null;
  let tokenEndpoint = 'authentication/oauth2/token/';
  let targetUrl = 'embed';

  const DEFAULT_IFRAME_ID = "datamplify-embed-iframe";

  /** -------------------------------------------------------
   * UTIL: Create iframe inside container
   * -------------------------------------------------------*/
  function createIframe(embedUrl, containerId) {
    const container = document.getElementById(containerId);

    if (!container) {
      console.error("[SDK] Container not found:", containerId);
      return null;
    }

    // Create iframe
    const iframe = document.createElement("iframe");
    iframe.id = DEFAULT_IFRAME_ID;
    iframe.src = embedUrl;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.allowFullscreen = true;

    container.innerHTML = ""; // clear old iframe if exists
    container.appendChild(iframe);

    return iframe;
  }

  /** -------------------------------------------------------
   * Auhenticate and get access token
   * -------------------------------------------------------*/
  async function authenticate() {
    if (!config.clientId || !config.clientSecret) {
      throw new Error("[SDK] Auth configuration missing");
    }

    if (accessToken) {
      return accessToken;
    }

    const formData = new FormData();
    formData.append("client_id", config.clientId);
    formData.append("client_secret", config.clientSecret);
    formData.append("grant_type", "client_credentials");

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      throw new Error("[SDK] Authentication failed");
    }

    const data = await response.json();
    accessToken = data.access_token;
    return accessToken;
  }

  /** -------------------------------------------------------
   * Send message to IFRAME
   * -------------------------------------------------------*/
  function postMessageToIframe(type, payload) {
    if (!iframeEl || !iframeEl.contentWindow) {
      console.warn("[SDK] Iframe not ready to post message");
      return;
    }

    iframeEl.contentWindow.postMessage(
      { source: "DATAMPLIFY_SDK", type, payload, accessToken, sdkType: config.type },
      "*"
    );
  }

  /** -------------------------------------------------------
   * LISTEN FOR MESSAGES FROM IFRAME
   * -------------------------------------------------------*/
  window.addEventListener("message", async function (event) {
    if (!event.data || event.data.source !== "DATAMPLIFY_APP") return;

    switch (event.data.type) {
      case "APP_READY":
        console.log("[SDK] App Ready");
        postMessageToIframe("INIT_CONFIG", event.data.payload);
        break;

      case "accessToken":
        accessToken = null;
        await authenticate();
        postMessageToIframe("accessToken", event.data.payload);
        break;

      default:
        console.log("All Events:", event.data);
        if (config.onEvent) {
          config.onEvent(event.data);
        }
    }
  });

  /** -------------------------------------------------------
   * PUBLIC: Init SDK
   * -------------------------------------------------------*/
  SDK.init = async function (options) {
    config = options || {};

    if (!config.clientUrl) {
      console.error("[SDK] Missing clientUrl");
      return;
    }

    if (!config.type) {
      console.error("[SDK] Missing type");
      return;
    }

    if (!config.apiUrl && config.type === 'client-credentials') {
      console.error("[SDK] Missing apiUrl");
      return;
    }

    if (!config.containerId) {
      console.error("[SDK] Missing containerId");
      return;
    }
    targetUrl = 'embed';
    targetUrl = config.clientUrl + targetUrl;
    try {
      if (config.type === 'client-credentials') {
        tokenEndpoint = 'authentication/oauth2/token/';
        tokenEndpoint = config.apiUrl + tokenEndpoint;
        await authenticate();
      }
      iframeEl = createIframe(targetUrl, config.containerId);
    } catch (err) {
      console.error(err.message);
      if (config.onError) config.onError(err);
    }

    return SDK;
  };

  /** -------------------------------------------------------
   * PUBLIC: Send Data to Embedded App
   * -------------------------------------------------------*/
  SDK.send = function (eventName, payload) {
    postMessageToIframe(eventName, payload);
  };

  /** -------------------------------------------------------
   * PUBLIC: Destroy SDK Instance
   * -------------------------------------------------------*/
  SDK.destroy = function () {
    const el = document.getElementById(DEFAULT_IFRAME_ID);
    if (el) el.remove();
    iframeEl = null;
  };

  /** -------------------------------------------------------
   * Attach to Window
   * -------------------------------------------------------*/
  global.DatamplifySDK = SDK;

})(window);