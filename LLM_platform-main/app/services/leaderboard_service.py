from app.repositories.leaderboard_repo import LeaderboardRepository
from typing import List, Dict, Any

class LeaderboardService:
    """
    排行榜服务层
    处理模型和数据集的排行榜逻辑
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
        return LeaderboardRepository.get_model_leaderboard(metric_name, limit, project_id)
    
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
        return LeaderboardRepository.get_dataset_leaderboard(metric_name, limit, project_id)
