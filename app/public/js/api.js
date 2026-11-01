(function () {
  async function request(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, opts);
    } catch (err) {
      throw new Error('Cannot reach the IDM service. Is the server running?');
    }
    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  const api = {
    get: (url) => request('GET', url),
    post: (url, body) => request('POST', url, body === undefined ? {} : body),
    put: (url, body) => request('PUT', url, body),
    del: (url, body) => request('DELETE', url, body),
    urlInfo: (url, username, password) => {
      const q = new URLSearchParams({ url });
      if (username) q.set('username', username);
      if (password) q.set('password', password);
      return request('GET', `/api/url/info?${q}`);
    },
    preview: (url, username, password) => request('POST', '/api/url/preview', { url, username, password }),
    scan: (payload) => request('POST', '/api/grabber/scan', payload),
  };

  class LiveConnection {
    constructor(onState, onNotice, onStatus) {
      this.onState = onState;
      this.onNotice = onNotice;
      this.onStatus = onStatus;
      this.source = null;
      this.retry = null;
      this.connect();
    }

    connect() {
      try {
        this.source = new EventSource('/api/events');
      } catch {
        this.scheduleReconnect();
        return;
      }
      this.source.addEventListener('open', () => this.onStatus && this.onStatus(true));
      this.source.addEventListener('state', (e) => {
        try {
          this.onState(JSON.parse(e.data));
        } catch {
          /* ignore malformed frame */
        }
      });
      this.source.addEventListener('notice', (e) => {
        try {
          this.onNotice && this.onNotice(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });
      this.source.addEventListener('error', () => {
        this.onStatus && this.onStatus(false);
        if (this.source && this.source.readyState === EventSource.CLOSED) this.scheduleReconnect();
      });
    }

    scheduleReconnect() {
      if (this.retry) return;
      this.retry = setTimeout(() => {
        this.retry = null;
        this.connect();
      }, 2500);
    }
  }

  window.Api = api;
  window.LiveConnection = LiveConnection;
})();
