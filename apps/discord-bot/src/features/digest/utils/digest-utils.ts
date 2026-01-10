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
        const frequency = formatCron(d.cronExpression);
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


export function formatCron(cron: string): string {
    const parts = cron.split(' ');
    
    if (parts.length < 5) return `\`${cron}\``;

    const [minute, hour, _day, _month, days] = parts;
    const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

    if (days === '*') {
        return `🔁 Todos os dias às ${time}`;
    } else {
        const dayMap = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        
        const dayParts = days.split(',');
        const dayNames = dayParts.map(d => dayMap[parseInt(d)]).filter(Boolean).join(', ');
        return `🔁 Semanal (${dayNames}) às ${time}`;
    }
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
