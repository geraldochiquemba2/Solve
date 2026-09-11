export default function PoliticaPrivacidade() {
  return (
    <>
      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">1. Âmbito e Aceitação</h3>
        <p>
          A presente Política de Privacidade estabelece o compromisso da nossa organização com a protecção
          dos dados pessoais dos nossos clientes, parceiros e utilizadores, de acordo com a <strong>Lei da Protecção de Dados Pessoais (Lei n.º 22/11, de 17 de Junho)</strong> da República de Angola.
        </p>
        <p className="mt-2">
          Ao aceder à nossa plataforma e partilhar os seus dados para agendamento de diagnósticos ou contratação de serviços de consultoria e mentoria, o utilizador consente o tratamento dos mesmos nos termos abaixo descritos.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">2. Entidade Responsável</h3>
        <p>
          Bruno Samora – Top Performance é a entidade responsável pela recolha, tratamento e conservação dos dados pessoais fornecidos, agindo no rigoroso cumprimento da legislação aplicável em Angola.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">3. Dados Recolhidos e Finalidade</h3>
        <p>Recolhemos apenas os dados estritamente necessários (nome, email, telefone, empresa e cargo) para:</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Avaliação e diagnóstico corporativo de alta performance.</li>
          <li>Agendamento de mentorias e workshops.</li>
          <li>Contacto comercial e envio de propostas personalizadas.</li>
          <li>Comunicações relevantes sobre eventos ou novos programas, se autorizado.</li>
        </ul>
        <p className="mt-2">
          Os dados recolhidos destinam-se exclusivamente a uso interno, não sendo vendidos, alugados ou cedidos a terceiros para fins de marketing sem consentimento expresso.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">4. Segurança e Confidencialidade</h3>
        <p>
          O sigilo e a confidencialidade são os pilares da nossa actuação com líderes e executivos. Implementamos as medidas técnicas e organizacionais adequadas para proteger os seus dados contra a destruição acidental ou ilícita, a perda, a alteração, a difusão ou o acesso não autorizado, em conformidade com o exigido pela Lei n.º 22/11.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">5. Direitos do Titular dos Dados</h3>
        <p>
          Nos termos da lei angolana, é garantido ao titular dos dados o direito de acesso, rectificação, actualização ou eliminação dos seus dados pessoais. Pode exercer estes direitos a qualquer momento, enviando um pedido por escrito através dos nossos contactos oficiais disponibilizados no rodapé do site.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">6. Agência de Protecção de Dados (APD)</h3>
        <p>
          Qualquer questão legal, disputa ou necessidade de esclarecimento adicional que não possa ser resolvida diretamente connosco pode ser submetida à apreciação da Agência de Protecção de Dados (APD) de Angola.
        </p>
      </section>

      <section>
        <h3 className="font-heading font-bold text-white text-lg mb-2">7. Alterações à Política</h3>
        <p>
          Reservamo-nos o direito de atualizar ou modificar a presente Política de Privacidade a qualquer momento, por forma a adaptá-la a eventuais alterações legislativas. Aconselhamos a consulta regular desta página.
        </p>
        <p className="mt-4 text-xs text-white/50">
          Última atualização: {new Date().toLocaleDateString('pt-PT')}
        </p>
      </section>
    </>
  )
}
