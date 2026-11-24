import { Redirect } from 'expo-router';

import { contactsHref } from '../guide-tabs';

export default function ContactsRedirect() {
  return <Redirect href={contactsHref} />;
}
