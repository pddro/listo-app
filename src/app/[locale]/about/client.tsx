'use client';

function Section({
  children,
  bg = 'transparent',
  id,
}: {
  children: React.ReactNode;
  bg?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      style={{
        backgroundColor: bg,
        padding: '80px 24px',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>{children}</div>
    </section>
  );
}

export default function AboutClient() {
  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#1A1A1A',
      }}
    >
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #FFF8F0 0%, #FFF0E6 100%)',
          padding: '100px 24px 80px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <p style={{ fontSize: '56px', marginBottom: '16px' }}>{'\u{1F96D}'}</p>
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '24px',
              letterSpacing: '-0.02em',
            }}
          >
            The list layer
            <br />
            <span style={{ color: '#FF6B35' }}>of the internet.</span>
          </h1>
          <p
            style={{
              fontSize: '20px',
              lineHeight: 1.6,
              color: '#4B5563',
              maxWidth: '580px',
              margin: '0 auto',
            }}
          >
            ListMango turns any content into a shareable checklist.
            No accounts. No downloads. No friction. Just lists — as
            easy as pen and paper, but smarter.
          </p>
        </div>
      </section>

      {/* The Power of Lists */}
      <Section>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
              textAlign: 'center',
            }}
          >
            Humans think in lists
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Before computers, before apps, before the internet — there were lists.
            Grocery lists scribbled on the back of envelopes. To-do lists on sticky notes.
            Packing lists before every trip. Lists are how the human brain organizes the
            world. They strip away the noise and leave only what matters: the things you
            need to <em>do</em>.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            The internet is full of incredible content — recipes with 2,000 words of backstory,
            travel guides buried in paragraphs, how-to articles that bury the steps in prose.
            The information is there. But it&apos;s not <em>actionable</em>. You can&apos;t check off
            a paragraph at the grocery store. You can&apos;t text someone a blog post and expect
            them to follow it step by step.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
            }}
          >
            That&apos;s the gap ListMango fills. We take the essential, actionable parts of
            any content and turn them into clean, tappable checklists you can save, share,
            and actually use. The way your brain already wants to consume it.
          </p>
        </div>
      </Section>

      {/* No Accounts, No Friction */}
      <Section bg="#FAFAFA" id="no-accounts">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
              textAlign: 'center',
            }}
          >
            Why no accounts? Because paper doesn&apos;t have a login screen.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Think about a paper checklist. You grab a piece of paper, you write things down,
            you hand it to someone. No sign-up. No email verification. No password.
            That&apos;s what made lists work for thousands of years — they&apos;re <em>instant</em>.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Most list apps make you create an account before you can write your first item.
            They put a wall between you and your thought. By the time you&apos;ve verified
            your email, you&apos;ve forgotten what you needed to buy.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '40px',
            }}
          >
            ListMango works like paper. Open it, make a list, share the link.
            Every list has a unique URL. Anyone with the link can view it,
            check things off, add items. No app download required.
            No account wall. No friction between thought and action.
          </p>

          {/* Stats / pillars */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
            }}
          >
            {[
              { stat: '0', label: 'accounts required', desc: 'Open and go. Like paper.' },
              { stat: '0', label: 'app downloads needed', desc: 'Works in any browser, any device.' },
              { stat: '1', label: 'link to share', desc: 'Every list has a URL. That\u2019s it.' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '24px',
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #E5E7EB',
                  textAlign: 'center',
                }}
              >
                <p
                  style={{
                    fontSize: '40px',
                    fontWeight: 800,
                    color: '#FF6B35',
                    marginBottom: '4px',
                  }}
                >
                  {item.stat}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#1A1A1A',
                    marginBottom: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}
                >
                  {item.label}
                </p>
                <p style={{ fontSize: '14px', color: '#6B7280' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* The List Layer */}
      <Section id="list-layer">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
              textAlign: 'center',
            }}
          >
            The list layer of the internet
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Every website has content that would be better as a list. The recipe blog has
            ingredients. The travel site has packing tips. The how-to guide has steps. The
            gift roundup has recommendations. The fitness article has exercises.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Right now, all of that stays locked inside paragraphs. Readers have to mentally
            extract the useful bits, copy them into a notes app, or screenshot fragments of
            a page. It&apos;s friction. And friction kills sharing.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            ListMango is building the <strong>list layer</strong> — an invisible layer that
            sits on top of the internet, extracting the actionable essence of any page and
            presenting it the way humans prefer: as a clean, organized, checkable list.
            Powered by AI, branded to the source, and shareable with one tap.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
            }}
          >
            Articles get read once. Lists get used, reused, and passed along.
            We&apos;re turning the internet&apos;s best content into its most shareable format.
          </p>
        </div>
      </Section>

      {/* Make it a List Button */}
      <Section bg="#FAFAFA" id="make-it-a-list">
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
            }}
          >
            The &quot;Make it a List&quot; button
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '24px',
            }}
          >
            Website owners can now add a single button to their pages. When a reader clicks
            it, the page content is instantly converted into a branded, shareable checklist.
            The reader gets a useful list. The website gets organic backlinks every time
            that list is shared. Everyone wins.
          </p>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.8,
              color: '#4B5563',
              marginBottom: '40px',
            }}
          >
            One line of code for any website. A free plugin for WordPress. AI handles the
            parsing — no manual formatting needed. The button matches your brand colors
            automatically. And every list created shows your site name, favicon, and a
            link back to the original page.
          </p>

          {/* Button preview mockup */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              backgroundColor: '#FF6B35',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: 600,
              marginBottom: '32px',
            }}
          >
            {'\u{1F96D}'} Make it a List
          </div>

          <div
            style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/make-a-list"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                backgroundColor: '#FF6B35',
                color: '#fff',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Get the Embed Code
            </a>
            <a
              href="/wordpress"
              style={{
                display: 'inline-block',
                padding: '14px 32px',
                backgroundColor: '#fff',
                color: '#1A1A1A',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid #E5E7EB',
              }}
            >
              WordPress Plugin
            </a>
          </div>
        </div>
      </Section>

      {/* Founder */}
      <Section id="founder">
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
              textAlign: 'center',
            }}
          >
            Built by a maker who believes in simple tools
          </h2>
          <div
            style={{
              padding: '32px',
              backgroundColor: '#FFF8F0',
              borderRadius: '20px',
              border: '1px solid #FFDFCC',
            }}
          >
            <p
              style={{
                fontSize: '17px',
                lineHeight: 1.8,
                color: '#4B5563',
                marginBottom: '24px',
              }}
            >
              ListMango was founded in 2026 by{' '}
              <strong style={{ color: '#1A1A1A' }}>Pedro Wunderlich</strong>, a
              Guatemalan serial inventor and entrepreneur. Pedro is the creator of{' '}
              <a
                href="https://wakeout.app"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#FF6B35', textDecoration: 'underline' }}
              >
                Wakeout
              </a>
              , the movement app named{' '}
              <strong style={{ color: '#1A1A1A' }}>App of the Year by Apple in 2020</strong>
              {' '}that has impacted millions of lives worldwide.
            </p>
            <p
              style={{
                fontSize: '17px',
                lineHeight: 1.8,
                color: '#4B5563',
                marginBottom: '24px',
              }}
            >
              The same philosophy that made Wakeout work — remove every barrier between the
              person and the action — drives ListMango. No accounts to create. No tutorials
              to sit through. No complexity to master. Just open it and make a list.
            </p>
            <p
              style={{
                fontSize: '17px',
                lineHeight: 1.8,
                color: '#4B5563',
              }}
            >
              &quot;The best tool is the one that gets out of your way,&quot; Pedro says.
              &quot;A paper list doesn&apos;t ask you to sign up. Neither should a digital one.&quot;
            </p>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section bg="#FAFAFA">
        <div
          style={{
            textAlign: 'center',
            maxWidth: '560px',
            margin: '0 auto',
          }}
        >
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 800,
              marginBottom: '16px',
              lineHeight: 1.3,
            }}
          >
            Ready to create a list?
          </h2>
          <p
            style={{
              fontSize: '17px',
              color: '#4B5563',
              marginBottom: '32px',
              lineHeight: 1.6,
            }}
          >
            No sign-up. No download. Just go.
          </p>

          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '16px 48px',
              backgroundColor: '#FF6B35',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Make a List
          </a>
        </div>
      </Section>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '40px 24px',
          borderTop: '1px solid #E5E7EB',
        }}
      >
        <a
          href="/"
          style={{
            fontSize: '14px',
            color: '#9CA3AF',
            textDecoration: 'none',
          }}
        >
          {'\u{1F96D}'} ListMango
        </a>
      </footer>
    </div>
  );
}
