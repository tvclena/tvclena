fetch("/api/env")
  .then(r => r.json())
  .then(env => {
    window.ENV = env;
  });
