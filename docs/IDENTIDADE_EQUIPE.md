# Identidade de equipe (fundação interna desativada)

O comando interno de emissão de admissão aceita um adaptador de funcionário. Esta base verifica assinatura RS256 em um JWT de acesso (`typ: at+jwt`) com chaves públicas do emissor HTTPS fixo, audiência exclusiva desta API e validade máxima de 15 min. Não usa links do token para buscar chaves. Nenhum provedor está selecionado; um provedor que emita outro perfil precisa de integração validada, não de aceitar qualquer JWT.

O token autentica a identidade, não concede papel. O banco precisa confirmar vínculo ativo no estabelecimento e na unidade exatos, com papel owner, manager ou attendant; papel viewer não emite. Dados de tenant, papel e permissão do JWT/cliente nunca substituem essa consulta. A emissão revalida o mesmo vínculo e papel dentro da instrução de inserção: suspensão, remoção ou perda da permissão imediatamente antes da escrita também bloqueiam. A migração é proposta, não cria usuários nem concede permissões.

Não há rota, login ou configuração real. Antes da ativação: escolher provedor e audiência exclusiva, definir cache/rotação de JWKS confiável, provisionar vínculos mínimos de modo auditável, proteger o ingresso e confirmar revogação/sessões conforme política do provedor, além de testar em prévia isolada. Nunca registrar o JWT em logs ou telemetria.
