document.addEventListener('DOMContentLoaded', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const currentTab = tabs[0];
      const statusDiv = document.getElementById('status');
      
      if (currentTab.url && currentTab.url.includes("myworkdayjobs.com")) {
        statusDiv.textContent = "✓ Active on Workday";
        statusDiv.classList.add('active');
      } else {
        statusDiv.textContent = "Not a Workday page";
      }
    });
  });