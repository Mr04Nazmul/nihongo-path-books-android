// Android 12 system WebView 91 predates Object.hasOwn, used by ts-fsrs.
if (typeof Object.hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    configurable: true,
    writable: true,
    value(object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
  });
}
