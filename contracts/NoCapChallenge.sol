// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title NoCap Challenge Escrow
/// @notice Refundable social commitments with review rules fixed when a pact is created.
contract NoCapChallenge {
    enum Status { Open, Settled, Cancelled }
    enum ReviewPolicy { Host, Majority, Unanimous }

    struct Challenge {
        address creator;
        string title;
        uint96 stake;
        uint64 startsAt;
        uint64 endsAt;
        uint16 maxParticipants;
        uint16 participantCount;
        uint16 approvedCount;
        ReviewPolicy reviewPolicy;
        Status status;
    }

    uint256 public challengeCount;
    mapping(uint256 => Challenge) private challenges;
    mapping(uint256 => address[]) private participants;
    mapping(uint256 => address[]) private joinRequesters;
    mapping(uint256 => mapping(address => bool)) public hasJoined;
    mapping(uint256 => mapping(address => bool)) public hasRequestedJoin;
    mapping(uint256 => mapping(address => bool)) public joinApproved;
    mapping(uint256 => mapping(address => bool)) public joinRequestReviewed;
    mapping(uint256 => mapping(address => string)) public proofUri;
    mapping(uint256 => mapping(address => bool)) public proofApproved;
    mapping(uint256 => mapping(address => bool)) public proofResolved;
    mapping(uint256 => mapping(address => mapping(address => bool))) public hasReviewed;
    mapping(uint256 => mapping(address => mapping(address => bool))) public reviewVote;
    mapping(uint256 => mapping(address => uint16)) public approvalVotes;
    mapping(uint256 => mapping(address => uint16)) public rejectionVotes;
    mapping(uint256 => mapping(address => uint256)) public claimable;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event ChallengeCreated(uint256 indexed challengeId, address indexed creator, string title, uint256 stake, ReviewPolicy reviewPolicy);
    event ChallengeJoined(uint256 indexed challengeId, address indexed participant);
    event JoinRequested(uint256 indexed challengeId, address indexed requester);
    event JoinRequestReviewed(uint256 indexed challengeId, address indexed requester, bool approved);
    event ProofSubmitted(uint256 indexed challengeId, address indexed participant, string proofUri);
    event ProofVerified(uint256 indexed challengeId, address indexed participant, bool approved);
    event ProofReviewed(uint256 indexed challengeId, address indexed participant, address indexed reviewer, bool approved);
    event ChallengeSettled(uint256 indexed challengeId, uint256 winners, uint256 payoutPerWinner);
    event PayoutClaimed(uint256 indexed challengeId, address indexed participant, uint256 amount);

    error ChallengeNotOpen();
    error ChallengeFull();
    error AlreadyJoined();
    error RequestAlreadyExists();
    error JoinNotApproved();
    error IncorrectStake();
    error InvalidSchedule();
    error InvalidCapacity();
    error NotParticipant();
    error NotCreator();
    error CannotReviewOwnProof();
    error ReviewNotOpen();
    error ReviewsIncomplete();
    error EmptyProof();
    error ProofMissing();
    error ChallengeNotEnded();
    error NothingToClaim();
    error TransferFailed();

    function createChallenge(
        string calldata title,
        uint64 startsAt,
        uint64 endsAt,
        uint16 maxParticipants,
        ReviewPolicy reviewPolicy
    ) external payable returns (uint256 challengeId) {
        if (msg.value == 0 || msg.value > type(uint96).max) revert IncorrectStake();
        if (startsAt < block.timestamp || endsAt <= startsAt || endsAt > block.timestamp + 30 days) revert InvalidSchedule();
        if (maxParticipants < 2 || maxParticipants > 100) revert InvalidCapacity();

        challengeId = ++challengeCount;
        challenges[challengeId] = Challenge({
            creator: msg.sender,
            title: title,
            stake: uint96(msg.value),
            startsAt: startsAt,
            endsAt: endsAt,
            maxParticipants: maxParticipants,
            participantCount: 1,
            approvedCount: 0,
            reviewPolicy: reviewPolicy,
            status: Status.Open
        });
        participants[challengeId].push(msg.sender);
        hasJoined[challengeId][msg.sender] = true;
        emit ChallengeCreated(challengeId, msg.sender, title, msg.value, reviewPolicy);
        emit ChallengeJoined(challengeId, msg.sender);
    }

    function joinChallenge(uint256 challengeId) external payable {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (challenge.participantCount >= challenge.maxParticipants) revert ChallengeFull();
        if (hasJoined[challengeId][msg.sender]) revert AlreadyJoined();
        if (!joinApproved[challengeId][msg.sender]) revert JoinNotApproved();
        if (msg.value != challenge.stake) revert IncorrectStake();

        hasJoined[challengeId][msg.sender] = true;
        challenge.participantCount++;
        participants[challengeId].push(msg.sender);
        emit ChallengeJoined(challengeId, msg.sender);
    }

    function requestToJoin(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (hasJoined[challengeId][msg.sender]) revert AlreadyJoined();
        if (hasRequestedJoin[challengeId][msg.sender]) revert RequestAlreadyExists();
        if (challenge.participantCount >= challenge.maxParticipants) revert ChallengeFull();

        hasRequestedJoin[challengeId][msg.sender] = true;
        joinRequesters[challengeId].push(msg.sender);
        emit JoinRequested(challengeId, msg.sender);
    }

    function reviewJoinRequest(uint256 challengeId, address requester, bool approved) external {
        Challenge storage challenge = challenges[challengeId];
        if (msg.sender != challenge.creator) revert NotCreator();
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (!hasRequestedJoin[challengeId][requester]) revert NotParticipant();
        if (approved && challenge.participantCount >= challenge.maxParticipants) revert ChallengeFull();

        joinApproved[challengeId][requester] = approved;
        joinRequestReviewed[challengeId][requester] = true;
        emit JoinRequestReviewed(challengeId, requester, approved);
    }

    function submitProof(uint256 challengeId, string calldata uri) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open || block.timestamp >= challenge.endsAt) revert ChallengeNotOpen();
        if (!hasJoined[challengeId][msg.sender]) revert NotParticipant();
        if (bytes(uri).length == 0) revert EmptyProof();
        proofUri[challengeId][msg.sender] = uri;
        emit ProofSubmitted(challengeId, msg.sender, uri);
    }

    function verifyProof(uint256 challengeId, address participant, bool approved) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open) revert ChallengeNotOpen();
        if (!hasJoined[challengeId][participant]) revert NotParticipant();
        if (bytes(proofUri[challengeId][participant]).length == 0) revert ProofMissing();
        if (block.timestamp < challenge.endsAt) revert ReviewNotOpen();

        if (challenge.reviewPolicy == ReviewPolicy.Host) {
            if (msg.sender != challenge.creator) revert NotCreator();
            _resolveProof(challengeId, participant, approved);
            emit ProofReviewed(challengeId, participant, msg.sender, approved);
            return;
        }

        if (!hasJoined[challengeId][msg.sender]) revert NotParticipant();
        if (msg.sender == participant) revert CannotReviewOwnProof();

        bool reviewed = hasReviewed[challengeId][participant][msg.sender];
        bool previousVote = reviewVote[challengeId][participant][msg.sender];
        if (reviewed && previousVote != approved) {
            if (previousVote) approvalVotes[challengeId][participant]--;
            else rejectionVotes[challengeId][participant]--;
        }
        if (!reviewed || previousVote != approved) {
            hasReviewed[challengeId][participant][msg.sender] = true;
            reviewVote[challengeId][participant][msg.sender] = approved;
            if (approved) approvalVotes[challengeId][participant]++;
            else rejectionVotes[challengeId][participant]++;
        }

        uint16 reviewers = challenge.participantCount - 1;
        uint16 approvalsNeeded = challenge.reviewPolicy == ReviewPolicy.Unanimous
            ? reviewers
            : reviewers / 2 + 1;
        uint16 rejectionsNeeded = reviewers - approvalsNeeded + 1;
        if (approvalVotes[challengeId][participant] >= approvalsNeeded) _resolveProof(challengeId, participant, true);
        else if (rejectionVotes[challengeId][participant] >= rejectionsNeeded) _resolveProof(challengeId, participant, false);
        emit ProofReviewed(challengeId, participant, msg.sender, approved);
    }

    function _resolveProof(uint256 challengeId, address participant, bool approved) private {
        Challenge storage challenge = challenges[challengeId];
        bool previous = proofApproved[challengeId][participant];
        bool wasResolved = proofResolved[challengeId][participant];
        if (!wasResolved || previous != approved) {
            proofApproved[challengeId][participant] = approved;
            proofResolved[challengeId][participant] = true;
            if (!wasResolved && approved) challenge.approvedCount++;
            else if (wasResolved && previous && !approved) challenge.approvedCount--;
            else if (wasResolved && !previous && approved) challenge.approvedCount++;
        }
        emit ProofVerified(challengeId, participant, approved);
    }

    function settleChallenge(uint256 challengeId) external {
        Challenge storage challenge = challenges[challengeId];
        if (challenge.status != Status.Open) revert ChallengeNotOpen();
        if (block.timestamp < challenge.endsAt) revert ChallengeNotEnded();

        address[] storage squad = participants[challengeId];
        for (uint256 i; i < squad.length; ++i) {
            if (bytes(proofUri[challengeId][squad[i]]).length != 0 && !proofResolved[challengeId][squad[i]]) {
                revert ReviewsIncomplete();
            }
        }

        challenge.status = Status.Settled;
        uint256 winners = challenge.approvedCount;
        uint256 payout;

        if (winners == 0) {
            payout = challenge.stake;
            for (uint256 i; i < squad.length; ++i) claimable[challengeId][squad[i]] = payout;
        } else {
            payout = (uint256(challenge.stake) * challenge.participantCount) / winners;
            for (uint256 i; i < squad.length; ++i) {
                if (proofApproved[challengeId][squad[i]]) claimable[challengeId][squad[i]] = payout;
            }
        }
        emit ChallengeSettled(challengeId, winners, payout);
    }

    function claim(uint256 challengeId) external {
        uint256 amount = claimable[challengeId][msg.sender];
        if (amount == 0 || hasClaimed[challengeId][msg.sender]) revert NothingToClaim();
        hasClaimed[challengeId][msg.sender] = true;
        claimable[challengeId][msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit PayoutClaimed(challengeId, msg.sender, amount);
    }

    function getChallenge(uint256 challengeId) external view returns (Challenge memory) {
        return challenges[challengeId];
    }

    function getParticipants(uint256 challengeId) external view returns (address[] memory) {
        return participants[challengeId];
    }

    function getJoinRequesters(uint256 challengeId) external view returns (address[] memory) {
        return joinRequesters[challengeId];
    }
}
