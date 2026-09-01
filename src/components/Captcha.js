import { esc } from '../app/utils.ts';

export const CAPTCHA_TYPES = {
  HCAPTCHA: 'hcaptcha',
  RECAPTCHA: 'recaptcha',
};

const DEFAULT_HCAPTCHA_SITEKEY = '10000000-ffff-ffff-ffff-000000000001'; // hCaptcha test key
const DEFAULT_RECAPTCHA_SITEKEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'; // reCAPTCHA v2 test key

const captchaScriptsLoaded = {
  [CAPTCHA_TYPES.HCAPTCHA]: false,
  [CAPTCHA_TYPES.RECAPTCHA]: false,
};

const captchaWidgets = new Map();

export function loadCaptchaScript(type, siteKey) {
  if (captchaScriptsLoaded[type]) {return Promise.resolve();}

  return new Promise((resolve, reject) => {
    if (type === CAPTCHA_TYPES.HCAPTCHA) {
      if (window.hcaptcha) {
        captchaScriptsLoaded[type] = true;
        return resolve();
      }
      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        captchaScriptsLoaded[type] = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    } else if (type === CAPTCHA_TYPES.RECAPTCHA) {
      if (window.grecaptcha) {
        captchaScriptsLoaded[type] = true;
        return resolve();
      }
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${esc(siteKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        captchaScriptsLoaded[type] = true;
        resolve();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    }
  });
}

export function Captcha({ 
  type = CAPTCHA_TYPES.HCAPTCHA, 
  siteKey, 
  theme = 'light',
  size = 'normal',
  onVerify,
  onExpire,
  onError,
  required = true,
  id,
  className = '',
}) {
  const captchaId = id || `captcha-${Math.random().toString(36).slice(2, 9)}`;
  const effectiveSiteKey = siteKey || (type === CAPTCHA_TYPES.HCAPTCHA ? DEFAULT_HCAPTCHA_SITEKEY : DEFAULT_RECAPTCHA_SITEKEY);
  
  const container = document.createElement('div');
  container.className = `captcha-container ${className}`.trim();
  container.dataset.captchaType = type;
  container.dataset.captchaId = captchaId;
  
  let widgetId = null;
  let token = null;
  
  const render = async () => {
    await loadCaptchaScript(type, effectiveSiteKey);
    
    if (type === CAPTCHA_TYPES.HCAPTCHA) {
      widgetId = window.hcaptcha.render(captchaId, {
        sitekey: effectiveSiteKey,
        theme,
        size,
        callback: (captchaToken) => {
          token = captchaToken;
          onVerify?.(token);
        },
        'expired-callback': () => {
          token = null;
          onExpire?.();
        },
        'error-callback': (err) => {
          onError?.(err);
        },
      });
    } else if (type === CAPTCHA_TYPES.RECAPTCHA) {
      // reCAPTCHA v2 invisible
      window.grecaptcha.ready(() => {
        widgetId = window.grecaptcha.render(captchaId, {
          sitekey: effectiveSiteKey,
          theme,
          size,
          callback: (captchaToken) => {
            token = captchaToken;
            onVerify?.(token);
          },
          'expired-callback': () => {
            token = null;
            onExpire?.();
          },
          'error-callback': (err) => {
            onError?.(err);
          },
        });
      });
    }
  };
  
  const reset = () => {
    if (type === CAPTCHA_TYPES.HCAPTCHA && widgetId !== null) {
      window.hcaptcha.reset(widgetId);
    } else if (type === CAPTCHA_TYPES.RECAPTCHA && widgetId !== null) {
      window.grecaptcha.reset(widgetId);
    }
    token = null;
  };
  
  const getToken = () => token;
  
  const execute = async () => {
    if (type === CAPTCHA_TYPES.RECAPTCHA && widgetId !== null) {
      return window.grecaptcha.execute(widgetId, { action: 'submit' });
    }
    return getToken();
  };
  
  // Initial render
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
  
  return {
    element: container,
    reset,
    getToken,
    execute,
    captchaId,
    type,
  };
}

// Invisible reCAPTCHA v3
export function InvisibleRecaptcha({ 
  siteKey = DEFAULT_RECAPTCHA_SITEKEY,
  action = 'submit',
  onVerify,
  onError,
}) {
  let executed = false;
  
  const execute = async () => {
    if (executed) {return null;}
    
    await loadCaptchaScript(CAPTCHA_TYPES.RECAPTCHA, siteKey);
    
    try {
      executed = true;
      const token = await window.grecaptcha.execute(siteKey, { action });
      onVerify?.(token);
      return token;
    } catch (err) {
      onError?.(err);
      executed = false;
      return null;
    }
  };
  
  return { execute };
}

// hCaptcha invisible
export function InvisibleHCaptcha({ 
  siteKey = DEFAULT_HCAPTCHA_SITEKEY,
  onVerify,
  onError,
}) {
  let widgetId = null;
  
  const execute = async () => {
    await loadCaptchaScript(CAPTCHA_TYPES.HCAPTCHA, siteKey);
    
    const containerId = `hcaptcha-invisible-${Math.random().toString(36).slice(2, 9)}`;
    const container = document.createElement('div');
    container.id = containerId;
    container.style.display = 'none';
    document.body.appendChild(container);
    
    return new Promise((resolve, reject) => {
      widgetId = window.hcaptcha.render(containerId, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token) => {
          onVerify?.(token);
          resolve(token);
        },
        'error-callback': (err) => {
          onError?.(err);
          reject(err);
        },
      });
      
      window.hcaptcha.execute(widgetId);
    });
  };
  
  const reset = () => {
    if (widgetId !== null) {
      window.hcaptcha.reset(widgetId);
    }
  };
  
  return { execute, reset };
}

// CAPTCHA verification service for Firebase Functions
export async function verifyCaptcha(token, type, secretKey) {
  if (!token) {return { success: false, error: 'No token provided' };}
  
  const url = type === CAPTCHA_TYPES.HCAPTCHA
    ? 'https://hcaptcha.com/siteverify'
    : 'https://www.google.com/recaptcha/api/siteverify';
  
  const params = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    const result = await response.json();
    return {
      success: result.success,
      score: result.score, // reCAPTCHA v3
      hostname: result.hostname,
      challenge_ts: result.challenge_ts,
      'error-codes': result['error-codes'],
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

