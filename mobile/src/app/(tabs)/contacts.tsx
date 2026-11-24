import { useState } from 'react';

import { sources } from '../../data/catalog';
import { contacts, hotline, localContacts } from '../../data/contacts';
import { ExternalLink, GuidePanel, GuideScreen, GuideText, icons } from '../../guide';
import { findContacts } from '../../search';
import { SearchField } from '../../search-field';

export default function ContactsScreen() {
  const [query, setQuery] = useState('');
  const matches = query.trim() ? findContacts(localContacts, query) : localContacts.slice(0, 2);
  return (
    <GuideScreen title="Контакти" adjustForKeyboard>
      <ContactCard contact={hotline} featured />
      <GuideText heading>Допомога у вашій громаді</GuideText>
      <SearchField value={query} onChange={setQuery} label="Місто або громада" />
      {matches.map(contact => <ContactCard key={contact.title} contact={contact} />)}
      {!matches.length && <GuideText type="support" announcement>У гіді поки немає прямого контакту цієї громади. Назвіть населений пункт на обласній лінії або перевірте пошук у Ветеран Pro.</GuideText>}
      {sources.localSpecialist && <ExternalLink url={sources.localSpecialist[1]} label="Як знайти фахівця у Ветеран Pro" icon={icons.external} />}
      <GuideText heading>Обласні та загальноукраїнські контакти</GuideText>
      {contacts.filter(contact => contact !== hotline && contact.source !== 'hub').map(contact => (
        <ContactCard key={contact.title} contact={contact} />
      ))}
    </GuideScreen>
  );
}

function ContactCard({ contact, featured = false }: { contact: typeof hotline; featured?: boolean }) {
  const source = sources[contact.source];
  const tone = featured ? 'onFeature' : 'foregroundMuted';
  return (
    <GuidePanel tone={featured ? 'feature' : 'surface'}>
      <GuideText heading tone={featured ? 'onFeature' : 'foreground'}>{contact.title}</GuideText>
      <GuideText type="support" tone={tone}>{contact.description}</GuideText>
      {contact.details && <GuideText type="support" tone={tone}>{contact.details}</GuideText>}
      <ExternalLink url={contact.dial} label={contact.phone} accessibilityLabel={`Зателефонувати: ${contact.phone}`}
        copyLabel="Скопіювати номер" inlineCopy tone={featured ? 'onFeature' : 'accent'} />
      {contact.email && <ExternalLink url={`mailto:${contact.email}`} label={contact.email} icon={icons.external} copyLabel="Скопіювати email" />}
      {source && <ExternalLink url={source[1]} label="Офіційне джерело" accessibilityLabel={`Офіційне джерело: ${contact.title}`}
        tone={featured ? 'onFeature' : 'accent'} icon={icons.external} />}
    </GuidePanel>
  );
}
