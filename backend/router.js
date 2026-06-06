
// 简单路由库，兼容 Cloudflare Workers
export class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler, pattern: this._pathToPattern(path) });
  }

  post(path, handler) {
    this.routes.push({ method: 'POST', path, handler, pattern: this._pathToPattern(path) });
  }

  put(path, handler) {
    this.routes.push({ method: 'PUT', path, handler, pattern: this._pathToPattern(path) });
  }

  delete(path, handler) {
    this.routes.push({ method: 'DELETE', path, handler, pattern: this._pathToPattern(path) });
  }

  _pathToPattern(path) {
    // 将 /api/tasks/:id 转换为正则表达式
    const regex = path.replace(/:([^/]+)/g, '([^/]+)');
    return new RegExp(`^${regex}$`);
  }

  async handle(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = pathname.match(route.pattern);
      if (match) {
        const params = {};
        const paramNames = route.path.match(/:([^/]+)/g);
        if (paramNames) {
          paramNames.forEach((name, index) => {
            const key = name.slice(1);
            params[key] = match[index + 1];
          });
        }
        request.params = params;
        return await route.handler(request, env);
      }
    }

    return new Response(JSON.stringify({ error: 'Not Found', path: pathname }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
