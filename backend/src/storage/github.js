// Almacenamiento en GitHub: el .xlsx vive en un repo y cada guardado
// genera UN commit que actualiza el mismo archivo (historial preservado).

const API = 'https://api.github.com';

class GithubStorage {
  constructor(cfg) {
    this.cfg = cfg;
  }

  _headers(extra = {}) {
    return {
      Authorization: `Bearer ${this.cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra
    };
  }

  async _rawContents() {
    const url = `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${this.cfg.path}?ref=${this.cfg.branch}`;
    const res = await fetch(url, { headers: this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`GitHub GET contents fallo (${res.status}): ${body}`);
    }
    return res.json();
  }

  async read() {
    const data = await this._rawContents();
    if (!data || !data.content) {
      throw new Error(`No se encontro ${this.cfg.path} en ${this.cfg.owner}/${this.cfg.repo}`);
    }
    return Buffer.from(data.content.replace(/\s/g, ''), 'base64');
  }

  async write(buffer) {
    const data = await this._rawContents();
    const sha = data ? data.sha : null;
    const message = `Guardado ${new Date().toISOString()}`;
    const body = {
      message,
      content: buffer.toString('base64'),
      branch: this.cfg.branch
    };
    if (sha) body.sha = sha;
    if (this.cfg.authorName) {
      body.author = { name: this.cfg.authorName, email: this.cfg.authorEmail };
    }
    const res = await fetch(`${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${this.cfg.path}`, {
      method: 'PUT',
      headers: this._headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub PUT contents fallo (${res.status}): ${err}`);
    }
    const result = await res.json();
    return { sha: result.commit?.sha || sha, message };
  }

  async history(limit = 30) {
    const url = `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/commits?path=${encodeURIComponent(this.cfg.path)}&per_page=${limit}`;
    const res = await fetch(url, { headers: this._headers() });
    if (!res.ok) return [];
    const commits = await res.json();
    return commits.map((c) => ({
      sha: c.sha,
      message: c.commit?.message || '',
      date: c.commit?.committer?.date || '',
      author: c.commit?.author?.name || ''
    }));
  }

  async readAt(sha) {
    const url = `${API}/repos/${this.cfg.owner}/${this.cfg.repo}/contents/${this.cfg.path}?ref=${sha}`;
    const res = await fetch(url, { headers: this._headers() });
    if (!res.ok) throw new Error(`No se pudo leer revision ${sha} (${res.status})`);
    const data = await res.json();
    return Buffer.from(data.content.replace(/\s/g, ''), 'base64');
  }
}

module.exports = { GithubStorage };