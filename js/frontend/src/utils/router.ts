export type RouteParams = Record<string, string>;
export type RouteHandler = (params: RouteParams) => void;

export interface Route {
  path: string;
  handler: RouteHandler;
  name?: string;
}

export class Router {
  private routes: Route[] = [];
  private currentRoute: Route | null = null;
  private currentParams: RouteParams = {};
  private isInitialized = false;

  constructor() {
    // Listen for browser navigation events
    window.addEventListener('popstate', () => this.handleRouteChange());
    
    // Don't handle initial route until routes are registered
    // this.handleRouteChange();
  }

  /**
   * Register a route with the router
   */
  addRoute(path: string, handler: RouteHandler, name?: string): void {
    this.routes.push({ path, handler, name });
    
    // Handle initial route when first route is added
    if (!this.isInitialized) {
      this.isInitialized = true;
      this.handleRouteChange();
    }
  }

  /**
   * Navigate to a specific path
   */
  navigate(path: string, pushState = true): void {
    if (pushState) {
      history.pushState({}, '', path);
    }
    this.handleRouteChange();
  }

  /**
   * Replace current route without adding to history
   */
  replace(path: string): void {
    history.replaceState({}, '', path);
    this.handleRouteChange();
  }

  /**
   * Get current path
   */
  getCurrentPath(): string {
    return window.location.pathname + window.location.search + window.location.hash;
  }

  /**
   * Get current route parameters
   */
  getCurrentParams(): RouteParams {
    return { ...this.currentParams };
  }

  /**
   * Get current route
   */
  getCurrentRoute(): Route | null {
    return this.currentRoute;
  }

  /**
   * Handle route changes
   */
  private handleRouteChange(): void {
    const currentPath = this.getCurrentPath();
    const matchedRoute = this.matchRoute(currentPath);

    if (matchedRoute) {
      this.currentRoute = matchedRoute.route;
      this.currentParams = matchedRoute.params;
      
      try {
        matchedRoute.route.handler(matchedRoute.params);
      } catch (error) {
        console.error('Error handling route:', error);
        this.handleNotFound();
      }
    } else {
      this.handleNotFound();
    }
  }

  /**
   * Match current path against registered routes
   */
  private matchRoute(path: string): { route: Route; params: RouteParams } | null {
    // Remove query string and hash for matching
    const pathOnly = path.split('?')[0].split('#')[0];

    for (const route of this.routes) {
      const match = this.matchPath(route.path, pathOnly);
      if (match) {
        return { route, params: match };
      }
    }

    return null;
  }

  /**
   * Match a path against a route pattern
   * Supports dynamic segments like /sessions/:id
   */
  private matchPath(pattern: string, path: string): RouteParams | null {
    // Handle root path specially
    if (pattern === '/' && path === '/') {
      return {};
    }
    
    // Convert pattern to regex
    const patternParts = pattern.split('/').filter(part => part.length > 0);
    const pathParts = path.split('/').filter(part => part.length > 0);

    // Must have same number of parts (unless pattern ends with *)
    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params: RouteParams = {};

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i];
      const pathPart = pathParts[i];

      if (patternPart.startsWith(':')) {
        // Dynamic segment
        const paramName = patternPart.substring(1);
        params[paramName] = decodeURIComponent(pathPart);
      } else if (patternPart !== pathPart) {
        // Static segment must match exactly
        return null;
      }
    }

    return params;
  }

  /**
   * Handle 404 not found
   */
  private handleNotFound(): void {
    console.warn('Route not found:', this.getCurrentPath());
    // Navigate to default route
    this.navigate('/', false);
  }
}

// Global router instance
let routerInstance: Router | null = null;

/**
 * Get the global router instance
 */
export function getRouter(): Router {
  if (!routerInstance) {
    routerInstance = new Router();
  }
  return routerInstance;
}

/**
 * Navigate to a path using the global router
 */
export function navigate(path: string, pushState = true): void {
  getRouter().navigate(path, pushState);
}

/**
 * Replace current route using the global router
 */
export function replace(path: string): void {
  getRouter().replace(path);
}