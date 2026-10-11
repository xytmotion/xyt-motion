// <xyt-player> custom element.
//
//   <xyt-player src="hero.xyt"></xyt-player>
//   <xyt-player><script type="text/xyt">fill mix(navy, black, y)</script></xyt-player>
//
// Attributes: src, paused, once (play one time), still (show the still frame, never animate)
// Events: xyt-load, xyt-error (detail = the errors)
import { Player } from './player.js';

export function defineElement(tag = 'xyt-player') {
  if (typeof customElements === 'undefined' || typeof HTMLElement === 'undefined' || customElements.get(tag)) return;

  class XytPlayerElement extends HTMLElement {
    static get observedAttributes() { return ['src', 'paused']; }

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>:host{display:block;position:relative}canvas{display:block;width:100%}</style><canvas part="canvas"></canvas>';
      this._canvas = root.querySelector('canvas');
      this._source = null;
      this.player = null;
    }

    connectedCallback() {
      if (this.player) return;
      this.player = new Player(this._canvas, {
        autoplay: !this.hasAttribute('paused'),
        loop: !this.hasAttribute('once'),
        still: this.hasAttribute('still'),
      });
      this.player.on('error', (errors) => this.dispatchEvent(new CustomEvent('xyt-error', { detail: errors })));
      this.player.on('load', (result) => this.dispatchEvent(new CustomEvent('xyt-load', { detail: result })));
      this._loadSource();
    }

    disconnectedCallback() {
      if (this.player) { this.player.destroy(); this.player = null; }
    }

    attributeChangedCallback(name) {
      if (!this.player) return;
      if (name === 'src') this._loadSource();
      if (name === 'paused') { if (this.hasAttribute('paused')) this.player.pause(); else this.player.play(); }
    }

    /** The program text. Setting it loads it. */
    get source() { return this._source; }
    set source(text) { this._source = String(text); if (this.player) this.player.load(this._source); }

    /** Shortcut for player.set(name, value). */
    set(name, value) { if (this.player) this.player.set(name, value); return this; }

    async _loadSource() {
      if (this._source != null) { this.player.load(this._source); return; }
      const inline = this.querySelector('script[type="text/xyt"]');
      if (inline) { this.player.load(inline.textContent); return; }
      const src = this.getAttribute('src');
      if (!src) {
        // When the library loads before this element is parsed, this runs as soon as the opening tag
        // is read, before the inline program exists. Look again once the page is parsed.
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => { if (this.player) this._loadSource(); }, { once: true });
        }
        return;
      }
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (this.player && this.getAttribute('src') === src) this.player.load(text);
      } catch (e) {
        this.dispatchEvent(new CustomEvent('xyt-error', { detail: [{ line: 0, message: `could not load ${src}: ${e.message}` }] }));
      }
    }
  }

  customElements.define(tag, XytPlayerElement);
}
