
try {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator');
  GlobalRegistrator.register();
} catch (e) {
  console.warn("GlobalRegistrator (happy-dom) not available. Skipping registration.");
}
