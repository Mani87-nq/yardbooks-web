import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import PricingSection from '@/components/PricingSection';
import ChatWidget from '@/components/ChatWidget';

export default async function LandingPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  
  if (accessToken) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg">
                YB
              </div>
              <span className="text-xl font-bold text-gray-900">YaadBooks</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium">Features</a>
              <a href="#why-switch" className="text-gray-600 hover:text-gray-900 font-medium">Why Switch</a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium">Pricing</a>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium">
                Sign In
              </Link>
              <Link 
                href="#pricing" 
                className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-4 bg-gradient-to-br from-emerald-50 via-white to-yellow-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="pt-8">
              <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold mb-6">
                <span className="text-lg">🇯🇲</span> Built Exclusively for Jamaica
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                The Only Accounting Software That{' '}
                <span className="text-emerald-600">Speaks Jamaican</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Stop struggling with foreign software. YaadBooks handles GCT, NIS, NHT, PAYE, and all your Jamaican tax compliance automatically. From invoicing to payroll — we've got you covered.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link 
                  href="#pricing" 
                  className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/30 text-center"
                >
                  Start Your Business Journey
                </Link>
                <a 
                  href="#demo-video" 
                  className="flex items-center justify-center gap-2 bg-white text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg border-2 border-gray-200 hover:border-emerald-300 transition-colors"
                >
                  <svg className="w-6 h-6 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  Watch Demo
                </a>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-500">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No credit card required
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Cancel anytime
                </div>
              </div>
            </div>
            
            {/* Dashboard Preview */}
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-1 shadow-2xl">
                <div className="bg-gray-900 rounded-xl overflow-hidden">
                  <div className="bg-gray-800 px-4 py-2 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-4 text-gray-400 text-sm">yaadbooks.com/dashboard</span>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-xs text-gray-500">Revenue (JMD)</p>
                        <p className="text-lg font-bold text-gray-900">$2.4M</p>
                        <p className="text-xs text-emerald-600">↑ 12% this month</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-xs text-gray-500">Invoices Paid</p>
                        <p className="text-lg font-bold text-gray-900">47</p>
                        <p className="text-xs text-emerald-600">↑ 8 this week</p>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <p className="text-xs text-gray-500">GCT Due</p>
                        <p className="text-lg font-bold text-gray-900">$124K</p>
                        <p className="text-xs text-amber-600">Due Mar 15</p>
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <p className="text-sm font-semibold text-gray-900">Recent Transactions</p>
                        <span className="text-xs text-emerald-600">View All</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Hi-Lo Foods</span>
                          <span className="text-emerald-600 font-medium">+$45,000</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">NCB Payment</span>
                          <span className="text-red-600 font-medium">-$12,500</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-lg font-bold text-sm shadow-lg transform rotate-3">
                🇯🇲 Made in Jamaica
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="py-8 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">500+</p>
              <p className="text-sm text-gray-500">Jamaican Businesses</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">$50M+</p>
              <p className="text-sm text-gray-500">Invoices Processed</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">100%</p>
              <p className="text-sm text-gray-500">TAJ Compliant</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">24/7</p>
              <p className="text-sm text-gray-500">Local Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Switch Section */}
      <section id="why-switch" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Why Jamaican Businesses Are Switching to YaadBooks
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Foreign software wasn't built for Jamaica. We were.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Pain Point Cards */}
            <div className="bg-red-50 rounded-2xl p-8 border-2 border-red-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">😤</span>
                </div>
                <h3 className="text-xl font-bold text-red-900">The Old Way</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Manually calculating GCT on every invoice
                </li>
                <li className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Struggling with NIS, NHT, PAYE calculations
                </li>
                <li className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Software that doesn't understand JMD
                </li>
                <li className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Support teams that don't know Jamaica
                </li>
                <li className="flex items-start gap-3 text-red-700">
                  <svg className="w-5 h-5 mt-0.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Paying in USD for basic features
                </li>
              </ul>
            </div>
            
            <div className="bg-emerald-50 rounded-2xl p-8 border-2 border-emerald-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-xl">🎉</span>
                </div>
                <h3 className="text-xl font-bold text-emerald-900">The YaadBooks Way</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-emerald-700">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  GCT calculated automatically — 15%, 25%, 0% rates
                </li>
                <li className="flex items-start gap-3 text-emerald-700">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  One-click payroll with all statutory deductions
                </li>
                <li className="flex items-start gap-3 text-emerald-700">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Built for JMD with multi-currency support
                </li>
                <li className="flex items-start gap-3 text-emerald-700">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Local support team who understand your business
                </li>
                <li className="flex items-start gap-3 text-emerald-700">
                  <svg className="w-5 h-5 mt-0.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Affordable pricing designed for Jamaica
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section id="demo-video" className="py-20 px-4 bg-gray-900">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            See YaadBooks in Action
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            Watch how easy it is to manage your Jamaican business
          </p>
          
          {/* Video Placeholder */}
          <div className="relative aspect-video bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
            <div className="absolute inset-0 flex items-center justify-center">
              <button className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/50">
                <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-4">
              <div className="flex-1 h-1 bg-gray-700 rounded-full">
                <div className="w-1/3 h-full bg-emerald-500 rounded-full"></div>
              </div>
              <span className="text-gray-400 text-sm">2:45</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Run Your Business
            </h2>
            <p className="text-xl text-gray-600">
              From invoicing to tax filing — all tailored for Jamaica
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                icon: '📄', 
                title: 'Professional Invoicing', 
                desc: 'Create beautiful invoices with automatic GCT calculation. Send via email or WhatsApp.' 
              },
              { 
                icon: '🛒', 
                title: 'Point of Sale', 
                desc: 'Fast, touch-friendly POS for retail and restaurants. Works offline too.' 
              },
              { 
                icon: '📦', 
                title: 'Inventory Management', 
                desc: 'Track stock levels, get alerts, manage multiple locations across Jamaica.' 
              },
              { 
                icon: '💰', 
                title: 'Payroll & Compliance', 
                desc: 'Auto-calculate NIS, NHT, PAYE, Ed Tax. Generate payslips instantly.' 
              },
              { 
                icon: '🏦', 
                title: 'Bank Reconciliation', 
                desc: 'Connect to NCB, Scotia, JMMB and more. Reconcile in minutes.' 
              },
              { 
                icon: '📊', 
                title: 'TAJ-Ready Reports', 
                desc: 'Generate GCT returns, P45s, and all compliance reports with one click.' 
              },
            ].map((feature) => (
              <div key={feature.title} className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-emerald-300 hover:shadow-lg transition-all">
                <div className="text-5xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-emerald-600">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-16">
            Trusted by Jamaican Business Owners
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                quote: "Finally, software that understands GCT! I used to spend hours on tax calculations. Now it's automatic.",
                name: "Michelle Brown",
                business: "Brown's Bakery, Kingston",
              },
              {
                quote: "The payroll feature alone saves me 2 days every month. NIS, NHT, PAYE — all done automatically.",
                name: "Andrew Williams",
                business: "Williams Construction, Montego Bay",
              },
              {
                quote: "Switched from QuickBooks. YaadBooks actually works for Jamaica. Best decision I made for my business.",
                name: "Karen Thompson",
                business: "KT Fashion Boutique, Mandeville",
              },
            ].map((testimonial, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-8">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-white text-lg mb-6">"{testimonial.quote}"</p>
                <div>
                  <p className="text-white font-semibold">{testimonial.name}</p>
                  <p className="text-emerald-200 text-sm">{testimonial.business}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* Final CTA */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join hundreds of Jamaican businesses already using YaadBooks to grow and thrive.
          </p>
          <Link 
            href="#pricing" 
            className="inline-block bg-emerald-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/30"
          >
            Start Your Free Trial Today
          </Link>
          <p className="mt-4 text-gray-500 text-sm">No credit card required</p>
        </div>
      </section>

      {/* AI Chat Widget */}
      <ChatWidget />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg">
                  YB
                </div>
                <span className="text-xl font-bold text-white">YaadBooks</span>
              </div>
              <p className="text-gray-500 mb-4">
                Jamaica's complete business management solution. Built by Jamaicans, for Jamaicans.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white">Features</a></li>
                <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
                <li><Link href="/login" className="hover:text-white">Sign In</Link></li>
                <li><Link href="/signup" className="hover:text-white">Get Started</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2">
                <li>📍 Kingston, Jamaica</li>
                <li>📧 support@yaadbooks.com</li>
                <li>📞 <a href="tel:+18766139119" className="hover:text-white">876-613-9119</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm">
              © 2026 YaadBooks. Made with ❤️ in Jamaica.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
