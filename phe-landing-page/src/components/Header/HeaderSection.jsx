export default function HeaderContainer() {
  return (
    <div className="w-full bg-[#050B1E] min-h-screen p-6 flex justify-center items-start">
      {/* Outer container */}
      <div className="w-full max-w-6xl rounded-2xl bg-[#0F1629] border border-white/10 py-32 px-6 text-center">
        
        {/* Eyebrow */}
        <p className="text-indigo-400 font-medium mb-4">
          Get the help you need
        </p>

        {/* Title */}
        <h1 className="text-white text-6xl font-bold tracking-tight mb-6">
          Support center
        </h1>

        {/* Subtitle */}
        <p className="text-gray-400 text-xl max-w-3xl mx-auto leading-relaxed">
          Anim aute id magna aliqua ad ad non deserunt sunt. 
          Qui irure qui lorem cupidatat commodo. 
          Elit sunt amet fugiat veniam occaecat fugiat.
        </p>

      </div>
    </div>
  );
}
