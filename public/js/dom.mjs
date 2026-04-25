export function createElement(tagName, options = {}, children = []) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, value);
      }
    }
  }

  for (const child of Array.isArray(children) ? children : [children]) {
    if (child) {
      element.appendChild(child);
    }
  }

  return element;
}

export function setButtonBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = label;
}

export function showNotice(element, message, tone = 'info') {
  element.textContent = message;
  element.className = `notice ${tone}`;
  element.hidden = false;
}

export function hideNotice(element) {
  element.textContent = '';
  element.hidden = true;
}

export function scrollIntoView(element) {
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
