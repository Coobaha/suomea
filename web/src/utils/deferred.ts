export class Deferred<T> extends Promise<T> {
  public state: 'pending' | 'fulfilled' | 'rejected';
  public resolve!: (value: PromiseLike<T> | T) => PromiseLike<T> | T;
  public reject!: (error?: any) => Promise<T>;

  constructor() {
    let res: (value: T | PromiseLike<T>) => void;
    let rej: (error?: any) => void;
    super((resolve, reject) => {
      res = resolve;
      rej = reject;
    });
    this.state = 'pending';
    this.resolve = (val: PromiseLike<T> | T) => {
      this.state = 'fulfilled';
      res(val);
      return val;
    };
    this.reject = (reason) => {
      this.state = 'rejected';
      rej(reason);
      return reason;
    };
  }
}

Deferred.prototype.constructor = Promise;
