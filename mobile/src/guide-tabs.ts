export const guideTabs = [
  { name: 'index', label: 'Головна', icon: 'house', selectedIcon: 'house-fill' },
  { name: 'services', label: 'Послуги', icon: 'squares-four', selectedIcon: 'squares-four-fill' },
  { name: 'assistant', label: 'Помічник', icon: 'assistant', selectedIcon: 'assistant-fill' },
  { name: 'news', label: 'Новини', icon: 'newspaper', selectedIcon: 'newspaper-fill' },
  { name: 'menu', label: 'Меню', icon: 'list-bullets', selectedIcon: 'list-bullets-fill' },
] as const;

export const contactsHref = { pathname: '/menu', params: { section: 'contacts' } } as const;
