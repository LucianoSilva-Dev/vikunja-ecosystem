import { EmbedBuilder } from 'discord.js';
import type { DigestRecord } from '../repositories/digest.repository';
import type { VikunjaApiService } from '../../../shared/services/vikunja-api.service';
import type { ILogger } from '../../../shared/types';


export interface DigestEmbedOptions {
    digests: DigestRecord[];
    projectMap: Map<number, string>;
    context: 'dm' | 'guild';
}

export function buildDigestListEmbed(options: DigestEmbedOptions): EmbedBuilder {
    const { digests, projectMap, context } = options;
    const frontendUrl = process.env.VIKUNJA_FRONTEND_URL || 'https://vikunja.io';

    const embed = new EmbedBuilder()
        .setTitle('📑 Resumos Configurados')
        .setColor(0x3498db)
        .setFooter({ text: 'Vikunja Digest' });

    if (!digests || digests.length === 0) {
        embed.setDescription('📭 Nenhum resumo configurado para este contexto.');
        return embed;
    }

    const description = digests.map((d, index) => {
        const projectTitle = projectMap.get(d.vikunjaProjectId) || `Projeto ${d.vikunjaProjectId}`;
        const projectUrl = `${frontendUrl}/projects/${d.vikunjaProjectId}`;
        
        const priorityLabel = getPriorityEmoji(d.minPriority);
        const frequency = formatDigestSchedule(d);
        const nextRun = d.nextRunAt 
            ? d.nextRunAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
            : 'Desconhecido';

        let line = `**${index + 1}. [${projectTitle}](${projectUrl})**\n` +
                   `   ${frequency}\n` +
                   `   🎯 Min Prio: ${priorityLabel} | 🔔 Próxima: ${nextRun}`;

        if (context === 'guild' && d.channelId) {
            line += `\n   📢 Canal: <#${d.channelId}>`;
        }

        return line;
    }).join('\n\n');

    embed.setDescription(description);

    return embed;
}

export function getPriorityEmoji(priority: number): string {
    const emojis = ['⚪', '🔵', '🟢', '🟡', '🟠', '🔴', '🔥'];
    const labels = ['Indefinida', 'Baixa', 'Média', 'Alta', 'Urgente', 'Crítica', 'FAÇA AGORA'];
    return `${emojis[priority] || '⚪'} ${labels[priority] || 'Indefinida'}`;
}



export function formatDigestSchedule(digest: DigestRecord): string {
    const { type, typeData, cronExpression } = digest;
    const parts = cronExpression.split(' ');
    
    if (parts.length < 5) return `\`${cronExpression}\``;

    const [minute, hour] = parts;
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

    if (type === 'daily') {
         return `🔁 Todos os dias às ${time}`;
    } else if (type === 'weekly') {
        const days = typeData?.days as number[] | undefined;
        if (days && days.length > 0) {
             const dayMap = ['', 'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
             const dayNames = days.map(d => dayMap[d]).join(', ');
             return `🔁 Semanal (${dayNames}) às ${time}`;
        }
        // Fallback if data missing but weekly
        return `🔁 Semanal às ${time}`;
    } else if (type === 'custom') {
        const interval = typeData?.interval;
        return `🔁 A cada ${interval || '?'} dias às ${time}`;
    }

    return `\`${cronExpression}\``;
}

export async function getProjectMap(
    apiService: VikunjaApiService,
    logger?: ILogger
): Promise<Map<number, string>> {
    const projectMap = new Map<number, string>();
    try {
        const projects = await apiService.listProjects();
        projects.forEach(p => {
          if (p.id) {
            projectMap.set(p.id, p.title || `Projeto ${p.id}`);
          }
        });
    } catch (e) {
        if (logger) {
            logger.warn('Failed to fetch projects for digest names', { error: e });
        }
    }
    return projectMap;
}
