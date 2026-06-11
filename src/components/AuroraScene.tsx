// Full-bleed flowing aurora background, mounted once in the root layout so it
// sits behind every page. Two layered, animated gradient sheets (see globals.css)
// — clearly moving, light enough to keep content readable, frozen under
// prefers-reduced-motion.
export default function AuroraScene() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora" />
      <div className="aurora aurora--2" />
    </div>
  );
}
