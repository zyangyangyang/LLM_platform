from typing import List, Dict, Any, Optional
from app.core.database import execute, fetch_all

class LeaderboardRepository:
    """
    排行榜仓库层
    处理模型和数据集排行榜的数据库查询
    """
    
    @staticmethod
    def get_model_leaderboard(metric_name: str, limit: int, project_id: str = None) -> List[Dict[str, Any]]:
        """
        获取模型排行榜
        根据指定的指标对模型进行排序
        
        Args:
            metric_name: 指标名称，例如 accuracy
            limit: 返回的记录数
            project_id: 项目ID，可选，不指定则返回所有项目的模型排行
        
        Returns:
            模型排行榜列表，包含模型名称、指标值、项目名称等信息
        """
        query = """
        SELECT 
            mc.id as model_id,
            mc.name as model_name,
            mc.provider as model_provider,
            p.name as project_name,
            AVG(em.metric_value) as avg_metric_value,
            COUNT(DISTINCT etr.task_id) as task_count
        FROM 
            eval_metrics em
        JOIN 
            eval_task_runs etr ON em.task_run_id = etr.id
        JOIN 
            eval_tasks et ON etr.task_id = et.id
        JOIN 
            model_configs mc ON et.model_config_id = mc.id
        JOIN 
            projects p ON mc.project_id = p.id
        WHERE 
            em.metric_name = %s
        """
        
        params = [metric_name]
        
        if project_id:
            query += " AND p.id = %s"
            params.append(project_id)
        
        query += """
        GROUP BY 
            mc.id, mc.name, mc.provider, p.name
        ORDER BY 
            avg_metric_value DESC
        LIMIT %s
        """
        params.append(limit)
        
        return fetch_all(query, params)
    
    @staticmethod
    def get_dataset_leaderboard(metric_name: str, limit: int, project_id: str = None) -> List[Dict[str, Any]]:
        """
        获取数据集排行榜
        根据指定的指标对数据集进行排序
        
        Args:
            metric_name: 指标名称，例如 accuracy
            limit: 返回的记录数
            project_id: 项目ID，可选，不指定则返回所有项目的数据集排行
        
        Returns:
            数据集排行榜列表，包含数据集名称、指标值、项目名称等信息
        """
        query = """
        SELECT 
            d.id as dataset_id,
            d.name as dataset_name,
            p.name as project_name,
            AVG(em.metric_value) as avg_metric_value,
            COUNT(DISTINCT etr.task_id) as task_count
        FROM 
            eval_metrics em
        JOIN 
            eval_task_runs etr ON em.task_run_id = etr.id
        JOIN 
            eval_tasks et ON etr.task_id = et.id
        JOIN 
            datasets d ON et.dataset_id = d.id
        JOIN 
            projects p ON d.project_id = p.id
        WHERE 
            em.metric_name = %s
        """
        
        params = [metric_name]
        
        if project_id:
            query += " AND p.id = %s"
            params.append(project_id)
        
        query += """
        GROUP BY 
            d.id, d.name, p.name
        ORDER BY 
            avg_metric_value DESC
        LIMIT %s
        """
        params.append(limit)
        
        return fetch_all(query, params)
