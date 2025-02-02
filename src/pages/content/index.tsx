import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import './style.css'
import { Save } from 'lucide-react'
import React from 'react'

const isDev = import.meta.env.MODE === 'development';

function SaveButton({ tweetElement }: { tweetElement: Element }) {
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ top: 0, left: 0 });

  React.useEffect(() => {
    const button = buttonRef.current;
    if (!button) return;

    const updatePosition = () => {
      const rect = button.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < 40;
      
      setTooltipPosition({
        top: showAbove ? rect.top - 24 : rect.bottom + 4,
        left: rect.left + rect.width / 2
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    return () => window.removeEventListener('scroll', updatePosition);
  }, []);

  React.useEffect(() => {
    const checkSaveStatus = async () => {
      const { user_id, is_authenticated } = await chrome.storage.local.get(['user_id', 'is_authenticated']);
      if (!is_authenticated) return;

      // Get tweet ID using existing logic
      const analyticsLink = tweetElement.querySelector('a[href*="/analytics"]')?.getAttribute('href');
      let tweetId = analyticsLink?.split('/status/')[1]?.split('/')[0];

      if (!tweetId) {
        const urlMatch = window.location.pathname.match(/\/status\/(\d+)/);
        if (urlMatch) {
          tweetId = urlMatch[1];
        }
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/twitter/tweet/${user_id}/${tweetId}`);
      if (response.ok) {
        const data = await response.json();
        setSaved(data.found);
      }
    };

    checkSaveStatus();
  }, []); // Run once on mount

  const handleSave = React.useCallback(async () => {
    const {is_authenticated} = await chrome.storage.local.get('is_authenticated');

    if (!is_authenticated) {
      console.log('Not authenticated');
      return;
    }

    // const tweetText = tweetElement.querySelector('[data-testid="tweetText"]')?.textContent;
    const authorHandle = tweetElement.querySelector('[data-testid="User-Name"] a')?.getAttribute('href')?.replace('/', '');
    
    // Get tweet ID from analytics link or URL if we're on a tweet page
    const analyticsLink = tweetElement.querySelector('a[href*="/analytics"]')?.getAttribute('href');
    let tweetId = analyticsLink?.split('/status/')[1]?.split('/')[0];

    // Fallback: Get ID from URL if we're on a tweet page and analytics link method failed
    if (!tweetId) {
      const urlMatch = window.location.pathname.match(/\/status\/(\d+)/);
      if (urlMatch) {
        tweetId = urlMatch[1];
      }
    }

    const {user_id} = await chrome.storage.local.get('user_id');
    
    // console.log(process.env.NODE_ENV, {
    //   id: tweetId,
    //   author: authorHandle,
    //   userId: user_id,
    // });

    const response = await fetch(`${import.meta.env.VITE_API_URL}/twitter/tweet/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tweetId,
        userId: user_id,
        author: authorHandle,
      })
    });

    if (!response.ok) {
      console.error('Failed to save tweet', response);
    }

    const data = await response.json();
    if (data.success) {
      if (saved) {
        setSaved(false);
      } else {
        setSaved(true);
      }
    }
  }, [tweetElement, saved]);

  return (
    <>
      <button 
        ref={buttonRef}
        className="p-2.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-900 group relative"
        onClick={handleSave}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <Save 
          size={18} 
          strokeWidth={2} 
          className={`transition-colors duration-200 ${
            saved 
              ? 'text-blue-500'
              : 'group-hover:stroke-[#1d9bf0] text-gray-500'
          }`} 
        />
      </button>
      {showTooltip && createPortal(
        <span 
          className="tooltip-enter fixed bg-gray-600/90 text-white text-xs rounded-sm px-1 py-0.5 -translate-x-1/2 whitespace-nowrap"
          style={{ 
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`
          }}
        >
          {saved ? 'Unave' : 'Save to Tweet Maestro'}
        </span>,
        document.body
      )}
    </>
  );
}

function injectButtonIntoTweet(tweetElement: Element) {
  if (tweetElement.querySelector('.our-injected-button')) return;
  
  const actionBar = tweetElement.querySelector('[role="group"]');
  if (!actionBar) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'our-injected-button';
  actionBar.appendChild(buttonContainer);
  
  const root = createRoot(buttonContainer);
  root.render(<SaveButton tweetElement={tweetElement} />);
}

// Initialize observer to watch for new tweets
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (node instanceof HTMLElement) {
        // Look for tweets in the added element and its children
        const tweets = node.querySelectorAll('article[data-testid="tweet"]');
        tweets.forEach(tweet => injectButtonIntoTweet(tweet));
      }
    });
  }
});

// Start observing
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Handle existing tweets
document.querySelectorAll('article[data-testid="tweet"]')
  .forEach(tweet => injectButtonIntoTweet(tweet));

console.log('Tweet button injector loaded');

// Function to hide engagement metrics
function hideEngagementMetrics() {
  if (!isDev) return;
  
  const observer = new MutationObserver((mutations) => {
    // Select spans inside analytics links
    const viewStats = document.querySelectorAll('a[href*="/analytics"]');
    viewStats.forEach(stat => {
      const element = stat as HTMLElement;
      element.style.display = 'none';
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Call it when content script loads
// hideEngagementMetrics();
