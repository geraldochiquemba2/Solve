export default function PoliticaCookies() {
  return (
    <>
      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">1. O que são Cookies?</h3>
        <p>
          Os cookies são pequenos ficheiros de texto armazenados no seu dispositivo (computador, tablet ou telemóvel) através do navegador de internet (browser) quando visita o nosso website. Eles permitem que o site recorde as suas ações e preferências durante um determinado período.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">2. Para que utilizamos Cookies?</h3>
        <p>
          Utilizamos cookies com a finalidade de melhorar a sua experiência de navegação e garantir o correto funcionamento da plataforma. Classificamos os nossos cookies da seguinte forma:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><strong>Cookies Estritamente Necessários:</strong> Essenciais para que o website funcione corretamente (e.g., memorizar consentimento de cookies). Não podem ser desativados.</li>
          <li><strong>Cookies Analíticos:</strong> Permitem-nos compreender como os visitantes interagem com o site, recolhendo informações estatísticas anónimas, ajudando-nos a melhorar os nossos serviços.</li>
          <li><strong>Cookies Funcionais:</strong> Permitem ao site memorizar escolhas do utilizador, proporcionando funcionalidades melhoradas e mais personalizadas.</li>
        </ul>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">3. Gestão e Consentimento</h3>
        <p>
          Ao abrigo das boas práticas e da Lei da Protecção de Dados Pessoais (Lei n.º 22/11), o tratamento de dados através de cookies não essenciais requer o seu consentimento. 
        </p>
        <p className="mt-2">
          Pode, a qualquer momento, configurar o seu navegador para recusar cookies ou ser notificado sempre que um cookie é armazenado. Contudo, informamos que a desativação de certos cookies poderá afetar a sua experiência de navegação ou impedir o correto funcionamento de certas áreas do nosso site.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">4. Atualizações</h3>
        <p>
          Esta Política de Cookies pode ser revista e atualizada pontualmente para refletir alterações aos cookies que utilizamos ou por razões legais e regulamentares.
        </p>
        <p className="mt-4 text-xs text-white/50">
          Última atualização: {new Date().toLocaleDateString('pt-PT')}
        </p>
      </section>
    </>
  )
}
