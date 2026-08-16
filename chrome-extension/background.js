chrome.runtime.onInstalled.addListener(() => {
  console.log('Gemini Agent Extension Ready');
  chrome.action.setBadgeText({ text: 'ON' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
});