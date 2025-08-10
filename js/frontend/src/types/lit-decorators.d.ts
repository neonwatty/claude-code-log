// Global type augmentation to override decorator types for legacy compatibility
declare global {
  interface ClassFieldDecorator<T = any> {
    (target: any, propertyKey: string | symbol): void;
  }

  interface ClassMethodDecorator<T = any> {
    (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor | void;
  }

  interface ClassDecorator<T = any> {
    (constructor: T): T | void;
  }
}

// Type overrides for Lit decorators to use legacy decorator system only
declare module 'lit/decorators.js' {
  export function customElement(tagName: string): ClassDecorator;
  export function property(options?: PropertyDeclaration): ClassFieldDecorator;
  export function state(): ClassFieldDecorator;
  export function query(selector: string): ClassFieldDecorator;
  export function queryAll(selector: string): ClassFieldDecorator;
  export function queryAssignedElements(options?: QueryAssignedElementsOptions): ClassFieldDecorator;
  export function queryAssignedNodes(options?: QueryAssignedNodesOptions): ClassFieldDecorator;
  export function eventOptions(options: AddEventListenerOptions): ClassMethodDecorator;

  interface PropertyDeclaration {
    attribute?: boolean | string;
    type?: any;
    converter?: any;
    reflect?: boolean;
    hasChanged?: (value: any, oldValue: any) => boolean;
    noAccessor?: boolean;
  }

  interface QueryAssignedElementsOptions {
    flatten?: boolean;
    selector?: string;
    slot?: string;
  }

  interface QueryAssignedNodesOptions {
    flatten?: boolean;
    slot?: string;
  }
}

export {};