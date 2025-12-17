import { ref } from 'vue';

let tooltipInstance = null;

const createTooltipElement = () => {
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s ease;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
};

const getTooltipElement = () => {
  if (!tooltipInstance) {
    tooltipInstance = createTooltipElement();
  }
  return tooltipInstance;
};

const positionTooltip = (tooltip, target) => {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  // Default position: above the target, centered
  let top = targetRect.top - tooltipRect.height - 8;
  let left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
  
  // If tooltip goes off the top of the viewport, show it below
  if (top < 8) {
    top = targetRect.bottom + 8;
  }
  
  // If tooltip goes off the left of the viewport
  if (left < 8) {
    left = 8;
  }
  
  // If tooltip goes off the right of the viewport
  if (left + tooltipRect.width > window.innerWidth - 8) {
    left = window.innerWidth - tooltipRect.width - 8;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
};

const showTooltip = (element, content) => {
  if (!content) return;
  
  const tooltip = getTooltipElement();
  tooltip.textContent = content;
  tooltip.style.opacity = '0';
  
  // Force reflow to get accurate dimensions
  tooltip.getBoundingClientRect();
  
  positionTooltip(tooltip, element);
  
  // Small delay to allow positioning before showing
  requestAnimationFrame(() => {
    tooltip.style.opacity = '1';
  });
};

const hideTooltip = () => {
  const tooltip = getTooltipElement();
  tooltip.style.opacity = '0';
};

export const vTooltip = {
  mounted(el, binding) {
    const content = binding.value;
    
    if (!content) return;
    
    el._tooltipShowHandler = () => showTooltip(el, content);
    el._tooltipHideHandler = hideTooltip;
    
    el.addEventListener('mouseenter', el._tooltipShowHandler);
    el.addEventListener('mouseleave', el._tooltipHideHandler);
    el.addEventListener('focus', el._tooltipShowHandler);
    el.addEventListener('blur', el._tooltipHideHandler);
  },
  
  updated(el, binding) {
    // Update handlers if content changes
    if (binding.value !== binding.oldValue) {
      if (el._tooltipShowHandler) {
        el.removeEventListener('mouseenter', el._tooltipShowHandler);
        el.removeEventListener('mouseleave', el._tooltipHideHandler);
        el.removeEventListener('focus', el._tooltipShowHandler);
        el.removeEventListener('blur', el._tooltipHideHandler);
      }
      
      const content = binding.value;
      
      if (content) {
        el._tooltipShowHandler = () => showTooltip(el, content);
        el._tooltipHideHandler = hideTooltip;
        
        el.addEventListener('mouseenter', el._tooltipShowHandler);
        el.addEventListener('mouseleave', el._tooltipHideHandler);
        el.addEventListener('focus', el._tooltipShowHandler);
        el.addEventListener('blur', el._tooltipHideHandler);
      }
    }
  },
  
  unmounted(el) {
    if (el._tooltipShowHandler) {
      el.removeEventListener('mouseenter', el._tooltipShowHandler);
      el.removeEventListener('mouseleave', el._tooltipHideHandler);
      el.removeEventListener('focus', el._tooltipShowHandler);
      el.removeEventListener('blur', el._tooltipHideHandler);
      delete el._tooltipShowHandler;
      delete el._tooltipHideHandler;
    }
    hideTooltip();
  }
};
