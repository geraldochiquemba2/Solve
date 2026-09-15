export default function TermosCondicoes() {
  return (
    <>
      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">1. Condições Gerais de Utilização</h3>
        <p>
          Os presentes Termos e Condições regulam o acesso e a utilização dos serviços de consultoria, mentoria executiva e corporate wellness providenciados por Bruno Samora.
          Ao solicitar um diagnóstico ou adquirir um serviço, a entidade ou o indivíduo reconhecem e aceitam as presentes diretrizes, formuladas ao abrigo da legislação angolana aplicável aos serviços comerciais e à prestação de serviços.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">2. Natureza dos Serviços</h3>
        <p>
          Os programas de Alta Performance e Wellness têm carácter formativo, estratégico e de mentoria comportamental. 
          <strong> Não substituem, em caso algum, aconselhamento médico, psicológico, psiquiátrico ou tratamento clínico adequado.</strong>
        </p>
        <p className="mt-2">
          As metodologias aplicadas visam a otimização da produtividade, gestão de energia e liderança. O cliente é responsável por validar a sua aptidão física ou mental para a implementação de novos hábitos junto dos profissionais de saúde competentes.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">3. Confidencialidade e Sigilo Profissional</h3>
        <p>
          Devido à natureza altamente sensível e estratégica das informações partilhadas (por parte de CEOs, Diretores e Instituições Governamentais), assumimos um compromisso absoluto com o sigilo.
        </p>
        <p className="mt-2">
          Nenhum dado estratégico, métrica financeira ou desafio organizacional discutido durante o diagnóstico ou programa será divulgado, servindo as informações estritamente para o propósito da mentoria ou consultoria.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">4. Propriedade Intelectual</h3>
        <p>
          Todos os conteúdos, metodologias, estruturas de workshops, materiais em vídeo e documentação fornecidos ("Materiais Bruno Samora") são de propriedade exclusiva da nossa organização.
        </p>
        <p className="mt-2">
          O cliente reconhece que o acesso a estes materiais não confere qualquer direito de reprodução, distribuição, revenda ou uso para fins comerciais fora do âmbito do programa acordado, sem autorização prévia por escrito.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">5. Reservas e Desmarcações</h3>
        <p>
          No agendamento de sessões de mentoria executiva ou palestras:
        </p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>As marcações devem ser respeitadas de forma a garantir a máxima eficácia da agenda.</li>
          <li>Desmarcações ou reagendamentos devem ser comunicados com uma antecedência mínima de 48 horas.</li>
          <li>O não comparecimento sem aviso prévio poderá implicar a não-restituição do valor da sessão correspondente (quando aplicável) ou a impossibilidade de remarcação de diagnósticos gratuitos.</li>
        </ul>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">6. Jurisdição e Resolução de Conflitos</h3>
        <p>
          Os presentes Termos e Condições regem-se pela lei da República de Angola. Para a resolução de quaisquer litígios emergentes da prestação de serviços, as partes acordam submeter-se à jurisdição exclusiva dos tribunais da Comarca de Luanda.
        </p>
      </section>

      <section>
        <p className="mt-4 text-xs text-white/50">
          Última atualização: {new Date().toLocaleDateString('pt-PT')}
        </p>
      </section>
    </>
  )
}
