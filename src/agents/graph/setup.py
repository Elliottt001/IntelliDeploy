from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from prompting import PromptManager
from src.agents.graph.conditional_logic import ConditionalLogic
from src.agents.graph.nodes import AgentNodeFactory
from src.agents.graph.state import AgentState
from src.agents.llm_runner import AgentLLMRunner


class GraphSetup:
    def __init__(
        self,
        *,
        llm_runner: AgentLLMRunner | None = None,
        prompt_manager: PromptManager | None = None,
        conditional_logic: ConditionalLogic | None = None,
    ) -> None:
        self.node_factory = AgentNodeFactory(
            prompt_manager=prompt_manager,
            llm_runner=llm_runner,
        )
        self.conditional_logic = conditional_logic or ConditionalLogic()

    def setup_graph(self):
        workflow = StateGraph(AgentState)

        workflow.add_node("thinking", self.node_factory.thinking_node)
        workflow.add_node("builder", self.node_factory.builder_node)
        workflow.add_node("reviewer", self.node_factory.reviewer_node)
        workflow.add_node("security", self.node_factory.security_node)
        workflow.add_node("consensus", self.node_factory.consensus_node)
        workflow.add_node("healing", self.node_factory.healing_node)
        workflow.add_node("finalize", self.node_factory.finalize_node)

        workflow.add_edge(START, "thinking")
        workflow.add_edge("thinking", "builder")

        workflow.add_edge("builder", "reviewer")
        workflow.add_edge("builder", "security")

        workflow.add_edge("reviewer", "consensus")
        workflow.add_edge("security", "consensus")

        workflow.add_conditional_edges(
            "consensus",
            self.conditional_logic.consensus_route,
            {
                "healing": "healing",
                "finalize": "finalize",
            },
        )
        workflow.add_conditional_edges(
            "healing",
            self.conditional_logic.healing_route,
            {
                "builder": "builder",
            },
        )
        workflow.add_edge("finalize", END)
        return workflow.compile()


def build_multi_agent_graph(llm_runner: AgentLLMRunner | None = None):
    return GraphSetup(llm_runner=llm_runner).setup_graph()

