import React, { useState } from 'react';
// Import your CSS module file here (adjust relative path if necessary)
import styles from '../components/common/Common.module.css';

export default function CollabPage() {
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    email: '',
    projectDetails: '',
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Collaboration proposal submitted:', formData);
    alert('Thank you! Our institutional collaboration team will review your proposal shortly.');
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', padding: '4rem 2rem' }}>
      
      {/* --- HERO / INTRO SECTION --- */}
      <section style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto 4rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', color: '#fff', marginBottom: '1rem' }}>
          Partner with <span style={{ color: 'var(--color-accent-gold)' }}>ScenARy</span>
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
          We collaborate with universities, museums, and historical institutes to bring heritage sites to life through high-fidelity Augmented Reality.
        </p>
        <a href="#propose-form" className={styles.btnPrimary} style={{ textDecoration: 'none' }}>
          Propose a Collaboration
        </a>
      </section>

      {/* --- BENEFITS CARDS (Using .contentCard) --- */}
      <section style={{ maxWidth: '1000px', margin: '0 auto 5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Benefit 1 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Digital Preservation</h3>
              <p>3D Spatial Scanning & Anchoring</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Convert historical sites, ruins, and artifacts into permanent, highly accurate 3D spatial models. Preserve fragile historical heritage in an immersive digital format accessible anywhere in the world.
            </p>
          </div>
        </div>

        {/* Benefit 2 */}
        <div className={styles.contentCard}>
          <div className={styles.contentImage}>
            <div className={styles.contentTitleOverlay}>
              <h3>Educational Immersion</h3>
              <p>Interactive Curriculum & Tours</p>
            </div>
          </div>
          <div className={styles.contentDetails}>
            <p className={styles.contentDescription}>
              Empower students, researchers, and visitors to interactively explore historical contexts on-site or remotely. Embed rich metadata, timeline triggers, and audio narratives directly into the AR space.
            </p>
          </div>
        </div>

      </section>

      {/* --- COLLABORATION PROCESS (Workflow Steps) --- */}
      <section style={{ maxWidth: '1000px', margin: '0 auto 5rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent-gold)', marginBottom: '3rem' }}>
          How Collaboration Works
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>01</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Proposal</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Submit site details, historical photos, or spatial scan data.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>02</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Co-Creation</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Our spatial engine maps anchors and renders interactive scenes.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>03</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Testing & Review</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Inspect and refine the experience in-situ with institution preview keys.</p>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-accent-gold)' }}>04</span>
            <h4 style={{ margin: '1rem 0 0.5rem', color: '#fff' }}>Public Launch</h4>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Publish live for visitors, students, and global explorers.</p>
          </div>
        </div>
      </section>

      {/* --- PROPOSAL FORM SECTION --- */}
      <section id="propose-form" className={styles.settingsContainer}>
        <div className={styles.modalContent} style={{ maxWidth: '650px', background: 'rgba(0,0,0,0.85)' }}>
          <div className={styles.modalHeader}>
            <h3>Propose an Institutional Collaboration</h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Are you representing an academic institute, museum, or historical landmark? Tell us about your project.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                className={styles.formControl}
                placeholder="e.g. Dr. Maria Santos"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Institution / Organization
              </label>
              <input
                type="text"
                name="institution"
                required
                className={styles.formControl}
                placeholder="e.g. National Historical Museum"
                value={formData.institution}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Institutional Email
              </label>
              <input
                type="email"
                name="email"
                required
                className={styles.formControl}
                placeholder="name@institution.edu"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--color-text-light)', fontSize: '0.85rem' }}>
                Project Proposal & Site Details
              </label>
              <textarea
                name="projectDetails"
                rows="4"
                required
                className={styles.formControl}
                placeholder="Describe the historical site, landmark, or curriculum assets you want to digitize into AR..."
                value={formData.projectDetails}
                onChange={handleChange}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button type="submit" className={styles.btnPrimary} style={{ width: '100%' }}>
                Submit Proposal
              </button>
            </div>
          </form>
        </div>
      </section>

    </div>
  );
}