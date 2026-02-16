'use client';

const MANGO = '\u{1F96D}';

function Section({
  children,
  bg = 'transparent',
}: {
  children: React.ReactNode;
  bg?: string;
}) {
  return (
    <section
      style={{
        backgroundColor: bg,
        padding: '80px 24px',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>{children}</div>
    </section>
  );
}

export default function MakeAListClient() {
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
          <p style={{ fontSize: '56px', marginBottom: '16px' }}>{MANGO}</p>
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '24px',
              letterSpacing: '-0.02em',
            }}
          >
            Your readers won&apos;t share your article.
            <br />
            <span style={{ color: '#FF6B35' }}>They&apos;ll share the list.</span>
          </h1>
          <p
            style={{
              fontSize: '20px',
              lineHeight: 1.6,
              color: '#4B5563',
              maxWidth: '560px',
              margin: '0 auto 40px',
            }}
          >
            One line of code. Any website. Readers turn your content into
            shareable checklists — and every list links back to you.
          </p>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="#get-started"
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
              href="#how-it-works"
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
              See How It Works
            </a>
          </div>
        </div>
      </section>

      {/* The Insight */}
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
            }}
          >
            Articles get read.
            <br />
            Lists get <em>used</em>.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.7,
              color: '#4B5563',
              marginBottom: '40px',
            }}
          >
            Think about it — when was the last time you texted someone a 2,000
            word recipe blog post? But a clean grocery list from that post?
            That gets sent instantly. Lists are actionable, portable, and
            shareable in a way articles never will be.
          </p>
        </div>

        {/* Comparison */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            maxWidth: '640px',
            margin: '0 auto',
          }}
        >
          <div
            style={{
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
              }}
            >
              Your article
            </p>
            <p style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
              Read once
            </p>
            <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: 1.5 }}>
              Bookmarked &quot;for later.&quot; Forgotten. The URL stays in one browser, on
              one device.
            </p>
          </div>
          <div
            style={{
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: '#FFF8F0',
              border: '1px solid #FFDFCC',
            }}
          >
            <p
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: '#FF6B35',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '12px',
              }}
            >
              The list from your article
            </p>
            <p style={{ fontSize: '32px', fontWeight: 800, marginBottom: '8px' }}>
              Shared, saved, used
            </p>
            <p style={{ fontSize: '15px', color: '#6B7280', lineHeight: 1.5 }}>
              Texted to a partner, checked off at the store, forwarded to a
              friend. Each share = a link back to your site.
            </p>
          </div>
        </div>
      </Section>

      {/* The Code */}
      <Section bg="#FAFAFA">
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
            }}
          >
            One{' '}
            <code
              style={{
                backgroundColor: '#1A1A1A',
                color: '#E5E7EB',
                padding: '4px 12px',
                borderRadius: '8px',
                fontSize: '24px',
              }}
            >
              &lt;script&gt;
            </code>{' '}
            tag. That&apos;s it.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.7,
              color: '#4B5563',
              marginBottom: '32px',
            }}
          >
            No npm install. No build step. No framework dependency.
            Paste one line of HTML and the button appears. Works with
            React, Vue, Svelte, plain HTML — or whatever your AI just generated.
          </p>

          {/* Code preview */}
          <div
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '16px',
            }}
          >
            <code
              style={{
                color: '#E5E7EB',
                fontSize: '14px',
                lineHeight: 1.6,
                wordBreak: 'break-all',
              }}
            >
              <span style={{ color: '#9CA3AF' }}>&lt;</span>
              <span style={{ color: '#FF6B35' }}>script</span>
              {' '}
              <span style={{ color: '#93C5FD' }}>src</span>
              <span style={{ color: '#9CA3AF' }}>=</span>
              <span style={{ color: '#86EFAC' }}>&quot;https://listmango.com/embed.js&quot;</span>
              {' '}
              <span style={{ color: '#93C5FD' }}>data-site</span>
              <span style={{ color: '#9CA3AF' }}>=</span>
              <span style={{ color: '#86EFAC' }}>&quot;your-site-id&quot;</span>
              <span style={{ color: '#9CA3AF' }}>&gt;&lt;/</span>
              <span style={{ color: '#FF6B35' }}>script</span>
              <span style={{ color: '#9CA3AF' }}>&gt;</span>
            </code>
          </div>
          <p style={{ fontSize: '13px', color: '#9CA3AF' }}>
            We auto-detect your branding — colors, favicon, site name
          </p>
        </div>
      </Section>

      {/* SEO Value Prop */}
      <Section>
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
            }}
          >
            Every shared list is a backlink to{' '}
            <span style={{ color: '#FF6B35' }}>your</span> site
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.7,
              color: '#4B5563',
              marginBottom: '40px',
            }}
          >
            When a reader creates a list from your page, it shows your site name,
            your favicon, and a link back to the original article. When they share
            that list — and they will — your site goes with it. Organic,
            reader-driven link building. You do nothing.
          </p>

          {/* Visual: branded list mockup */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              border: '1px solid #E5E7EB',
              padding: '20px',
              maxWidth: '400px',
              margin: '0 auto',
              textAlign: 'left',
            }}
          >
            {/* Source bar mockup */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: '#F9FAFB',
                borderRadius: '10px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  backgroundColor: '#E5E7EB',
                }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Your Website
              </span>
              <span style={{ fontSize: '12px', color: '#FF6B35', marginLeft: 'auto' }}>
                View original &rarr;
              </span>
            </div>

            {/* List items mockup */}
            {['Ingredient one', 'Ingredient two', 'Ingredient three'].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 0',
                  borderBottom: i < 2 ? '1px solid #F3F4F6' : 'none',
                }}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: '2px solid #D1D5DB',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: '15px', color: '#374151' }}>{item}</span>
              </div>
            ))}
          </div>
          <p
            style={{
              fontSize: '13px',
              color: '#9CA3AF',
              marginTop: '12px',
            }}
          >
            Every list shows your branding and links to the original page
          </p>
        </div>
      </Section>

      {/* How It Works */}
      <Section bg="#FAFAFA">
        <div id="how-it-works">
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '48px',
              textAlign: 'center',
            }}
          >
            Two minutes. No dependencies. Zero maintenance.
          </h2>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '40px',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            {[
              {
                num: '1',
                title: 'Enter your website URL',
                desc: 'ListMango auto-detects your branding — colors, favicon, site name. No account needed.',
              },
              {
                num: '2',
                title: 'Copy one line of code',
                desc: 'A single <script> tag. Paste it anywhere on your page — before </body>, in a component, wherever you want the button.',
              },
              {
                num: '3',
                title: 'Readers click and share',
                desc: 'Your content becomes a branded checklist they can save, share, and use. Every list links back to your site.',
              },
            ].map((step) => (
              <div
                key={step.num}
                style={{
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    backgroundColor: '#FF6B35',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '18px',
                    flexShrink: 0,
                  }}
                >
                  {step.num}
                </div>
                <div>
                  <p
                    style={{
                      fontWeight: 700,
                      fontSize: '18px',
                      marginBottom: '6px',
                    }}
                  >
                    {step.title}
                  </p>
                  <p
                    style={{
                      fontSize: '16px',
                      color: '#4B5563',
                      lineHeight: 1.6,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Use Cases */}
      <Section>
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 700,
            marginBottom: '40px',
            textAlign: 'center',
          }}
        >
          Works with any content that has actionable items
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            maxWidth: '720px',
            margin: '0 auto',
          }}
        >
          {[
            { emoji: '\u{1F373}', title: 'Recipe blogs', desc: 'Ingredients become a grocery list' },
            { emoji: '\u2708\uFE0F', title: 'Travel guides', desc: 'Packing lists and itineraries' },
            { emoji: '\u{1F527}', title: 'How-to articles', desc: 'Steps become a checklist' },
            { emoji: '\u{1F381}', title: 'Gift guides', desc: 'Recommendations become a shopping list' },
            { emoji: '\u{1F4DA}', title: 'Resource roundups', desc: 'Links and tools to check off' },
            { emoji: '\u{1F3CB}\uFE0F', title: 'Fitness & health', desc: 'Workout plans and meal prep' },
          ].map((uc) => (
            <div
              key={uc.title}
              style={{
                padding: '20px',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
              }}
            >
              <p style={{ fontSize: '28px', marginBottom: '8px' }}>{uc.emoji}</p>
              <p style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                {uc.title}
              </p>
              <p style={{ fontSize: '14px', color: '#6B7280' }}>{uc.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Works Everywhere */}
      <Section bg="#FAFAFA">
        <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              marginBottom: '24px',
              lineHeight: 1.3,
            }}
          >
            Works with every stack
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.7,
              color: '#4B5563',
              marginBottom: '32px',
            }}
          >
            It&apos;s a script tag. If your site renders HTML, it works.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            {[
              'HTML',
              'React',
              'Next.js',
              'Vue',
              'Nuxt',
              'Svelte',
              'Astro',
              'Hugo',
              'Jekyll',
              'Squarespace',
              'Wix',
              'Webflow',
              'Shopify',
              'Ghost',
              'Framer',
            ].map((tech) => (
              <span
                key={tech}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#fff',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#374151',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
          <p
            style={{
              fontSize: '14px',
              color: '#9CA3AF',
              marginTop: '16px',
            }}
          >
            Vibe-coded your site with AI? That works too.
          </p>
        </div>
      </Section>

      {/* CTA */}
      <Section>
        <div
          id="get-started"
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
            Ready to turn readers into sharers?
          </h2>
          <p
            style={{
              fontSize: '17px',
              color: '#4B5563',
              marginBottom: '32px',
              lineHeight: 1.6,
            }}
          >
            Free forever. No account. No tracking. Just a button that makes your
            content more shareable.
          </p>

          <a
            href="/embed"
            style={{
              display: 'inline-block',
              padding: '16px 40px',
              backgroundColor: '#FF6B35',
              color: '#fff',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: '24px',
            }}
          >
            Get Your Embed Code
          </a>

          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>
            On WordPress?{' '}
            <a
              href="/wordpress"
              style={{ color: '#FF6B35', textDecoration: 'underline' }}
            >
              Get the free plugin
            </a>{' '}
            instead — even easier.
          </p>
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
          {MANGO} ListMango
        </a>
      </footer>
    </div>
  );
}
