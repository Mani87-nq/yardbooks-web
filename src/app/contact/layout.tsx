import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | YaadBooks',
  description:
    'Get in touch with the YaadBooks team. We are here to help your Jamaican business with accounting, invoicing, payroll, and more.',
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
